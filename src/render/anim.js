// 애니메이션 엔진. 게임 규칙과는 무관하게 "지금 화면에 어떻게 보일지"만 계산한다.
// - 한 번 재생(행동 반응, 부화, 진화): play(type, data)
// - 평소 움직임(깜빡임, 걸어 다니기, 숨쉬기)과 상태 표현(눈물, 어지러움, Zzz)은 매 프레임 계산
// 결과(frame)는 screen.js 가 그린다. 시간은 실제 시각(ms, performance.now) 기준.

export const DUR = {
  meal: 1800, snack: 1400, play: 2200, wash: 1800, lightOff: 900, lightOn: 700,
  medicine: 1600, refuse: 900, sleepyRefuse: 1000, hatch: 2600, evolve: 3000, pet: 800, poop: 500,
  greet: 2200, greetBig: 3200, tidy: 700, mgLook: 1100, farewell: 3800,
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

export function createAnimator() {
  return {
    cur: null,
    wander: { x: 0, target: 0, nextAt: 2000, facing: 1 },
    blink: { nextAt: 1500, until: 0 },
    hop: { at: -1e9, nextAt: 6000 },
    lastT: 0,
    fx: [], // 화면 위치에 붙는 짧은 효과(똥 치우기 연기 등)
    minigame: false, // 미니게임 중이면 가운데에서 고민하는 자세
  };
}

export function addFx(a, type, x, y, now, dur = 600) {
  a.fx.push({ type, x, y, start: now, dur });
}

export function play(a, type, now, data = {}) {
  a.cur = { type, start: now, dur: DUR[type] || 1000, data };
}

export function busy(a, now) {
  return !!(a.cur && now - a.cur.start < a.cur.dur);
}

// scene: { stage, theme, poops, asleep, lightOn, sick, mood, hunger, napping }
export function frame(a, now, scene, { roam = 20 } = {}) {
  const dt = Math.min(100, now - (a.lastT || now));
  a.lastT = now;
  const f = {
    pose: { dx: 0, dy: 0, sx: 1, sy: 1, eyes: null, mouth: null, tears: false, dizzy: false, facing: a.wander.facing }, // eyes·mouth가 null이면 표정 체계가 고른다
    props: [], // { sprite, x, y, scale, alpha } — x,y는 펫 발 밑 가운데 기준 도트 좌표
    texts: [], // { text, x, y, alpha, size }
    poopAlpha: 1, poopPop: 0,
    darkness: scene.lightOn ? (scene.asleep ? 0.18 : 0) : 0.62,
    flash: 0,
    egg: null, // { shake, cracks }
    showKey: null, // 진화·부화 중 다른 모습을 보여줄 때
    silhouette: false,
    fx: [],
  };
  a.fx = a.fx.filter((x) => now - x.start < x.dur);
  f.fx = a.fx.map((x) => ({ ...x, t: (now - x.start) / x.dur }));
  const p = f.pose;
  f.hidePet = false; f.petAlpha = 1;
  // 떠난 뒤: 펫은 없고 편지(여행) 또는 별(별이 됨)만 남는다
  if (scene.ended && !(a.cur && a.cur.type === "farewell")) {
    f.hidePet = true;
    if (scene.ended === "star") f.props.push({ sprite: "bigStar", x: 0, y: -70 + Math.sin(now / 600) * 3, scale: 2, alpha: 0.6 + Math.sin(now / 300) * 0.4 });
    else f.props.push({ sprite: "letter", x: 0, y: -2, scale: 2, alpha: 1 });
    return f;
  }
  const calm = scene.stage !== "egg" && !scene.asleep && !scene.napping;
  const crying = scene.hunger <= 0 || scene.mood <= 0;

  // ---- 평소 움직임 ----
  // 숨쉬기
  const breath = Math.sin(now / 420);
  p.sy = 1 + breath * 0.025; p.sx = 1 - breath * 0.02;
  if (scene.asleep || scene.napping) { p.sy = 1 + Math.sin(now / 900) * 0.04; p.sx = 1 - Math.sin(now / 900) * 0.03; }
  // 깜빡임
  if (now > a.blink.nextAt) { a.blink.until = now + 130; a.blink.nextAt = now + 2200 + hash(now) * 3000; }
  if (now < a.blink.until) p.eyes = "closed";
  // 걸어 다니기 (기분 좋고 깨어 있을 때)
  const w = a.wander;
  if (calm && !crying && !scene.sick && !busy(a, now)) {
    if (now > w.nextAt) { w.target = (hash(now * 0.7) * 2 - 1) * roam; w.nextAt = now + 3000 + hash(now * 1.3) * 5000; }
  } else if (!busy(a, now)) {
    w.target = w.x; // 멈춤
  }
  const diff = w.target - w.x;
  if (Math.abs(diff) > 0.3) {
    const step = Math.sign(diff) * Math.min(Math.abs(diff), (dt / 1000) * 14);
    w.x += step; w.facing = Math.sign(diff);
    p.dy -= Math.abs(Math.sin(now / 90)) * 1.5; // 통통 걷기
  }
  p.dx = w.x; p.facing = w.facing;
  // 기분이 아주 좋으면 가끔 콩 뛰기
  if (calm && scene.mood > 80 && !busy(a, now) && now > a.hop.nextAt) { a.hop.at = now; a.hop.nextAt = now + 7000 + hash(now) * 6000; }
  const ht = (now - a.hop.at) / 450;
  if (ht >= 0 && ht < 1) { p.dy -= Math.sin(ht * Math.PI) * 6; p.eyes = "happy"; }

  // 미니게임 중: 가운데에서 어느 쪽 볼지 고민
  if (a.minigame && !busy(a, now)) {
    w.target = 0; w.x += (0 - w.x) * 0.2; p.dx = w.x;
    p.eyes = Math.floor(now / 700) % 4 === 0 ? "closed" : null; p.mouth = "o";
    p.sx *= 1 + Math.sin(now / 160) * 0.02;
  }

  // ---- 상태 표현 ----
  if (scene.asleep || scene.napping) {
    p.eyes = "sleep";
    for (let i = 0; i < 3; i++) {
      const ph = ((now / 1800) + i / 3) % 1;
      f.texts.push({ text: "z", x: 10 + ph * 8, y: -26 - ph * 16, alpha: Math.sin(ph * Math.PI), size: 6 + ph * 5 });
    }
  }
  if (calm && crying) {
    p.tears = true;
    p.dx += Math.sin(now / 60) * 0.4; // 훌쩍
  }
  if (scene.sick && !scene.asleep) { p.dizzy = true; p.dx += Math.sin(now / 500) * 1.5; }
  if (calm && !crying && scene.hunger <= 20 && !busy(a, now)) {
    const ph = (now % 3000) / 3000;
    if (ph < 0.7) f.props.push({ sprite: "hungryBubble", edge: 1, x: -10, y: -40 - Math.sin(ph * Math.PI) * 2, scale: 2, alpha: Math.min(1, ph * 6, (0.7 - ph) * 6) });
  }
  if (scene.poops >= 2) {
    for (let i = 0; i < 2; i++) f.texts.push({ text: "~", x: -34 + i * 64, y: -8 - ((now / 600 + i) % 1) * 6, alpha: 0.6, size: 7, color: "#8a5a3c", abs: true });
  }

  // ---- 한 번 재생 ----
  const c = a.cur;
  if (c) {
    const t = (now - c.start) / c.dur;
    if (t >= 1) { a.cur = null; }
    else applyOneShot(f, c, t, now, scene);
  }
  return f;
}

function applyOneShot(f, c, t, now, scene) {
  const p = f.pose;
  switch (c.type) {
    case "meal": {
      // 밥그릇이 톡 나타나고 → 몸을 기울여 냠냠(입 벌렸다 닫았다) → 그릇이 비고 → 하트
      const bowl = t < 0.45 ? "bowlFull" : t < 0.75 ? "bowlHalf" : "bowlEmpty";
      const pop = ease(t / 0.12);
      f.props.push({ sprite: bowl, edge: 1, x: 8, y: -4 * pop + 4, scale: 2, alpha: t > 0.88 ? (1 - t) / 0.12 : 1 });
      if (t > 0.15 && t < 0.85) {
        p.facing = 1; p.dx += 3; p.sx *= 1.04;
        p.mouth = Math.floor(now / 160) % 2 ? "open" : "flat";
        p.dy -= Math.abs(Math.sin(now / 160 * Math.PI)) * 1;
        for (let i = 0; i < 3; i++) { // 밥알이 톡톡 튐
          const ph = ((now / 420) + i / 3) % 1;
          f.props.push({ sprite: "crumb", edge: 1, x: -10 + i * 4 + ph * 6, y: -10 - Math.sin(ph * Math.PI) * 12, scale: 1, alpha: 1 - ph });
        }
      }
      if (t > 0.85) { p.eyes = "happy"; p.mouth = "smile"; f.props.push({ sprite: "heart", x: 0, y: -34 - (t - 0.85) * 60, scale: 2, alpha: 1 }); }
      break;
    }
    case "snack": {
      // 과자가 위에서 떨어져 입으로 → 냠냠 → 하트 두 개
      const fall = ease(t / 0.35);
      if (t < 0.4) f.props.push({ sprite: "cookie", x: -3, y: -50 + fall * 30, scale: 2, alpha: 1 });
      if (t < 0.35) { p.mouth = "open"; p.dy -= Math.sin((t / 0.35) * Math.PI) * 2; }
      else if (t < 0.75) { p.mouth = Math.floor(now / 140) % 2 ? "open" : "flat"; p.sy *= 0.96 + Math.abs(Math.sin(now / 140)) * 0.06; }
      else { p.eyes = "happy"; p.mouth = "smile"; for (let i = 0; i < 2; i++) f.props.push({ sprite: "heart", x: -10 + i * 20, y: -32 - (t - 0.75) * 70 - i * 4, scale: 2, alpha: 1 - (t - 0.75) * 2 }); }
      break;
    }
    case "play": {
      // 공이 통통 튀고 펫이 따라 점프 → 이기면 반짝, 지면 땀방울
      const k = t * 3; // 점프 3번
      const ph = k % 1;
      const ballX = Math.sin(t * Math.PI * 3) * 22;
      const ballY = -Math.abs(Math.sin(t * Math.PI * 6)) * 26;
      if (t < 0.85) f.props.push({ sprite: "ball", edge: Math.sign(ballX) || 1, x: Math.abs(ballX) * Math.sign(ballX || 1) * 0.6 + 6 * (Math.sign(ballX) || 1), y: ballY, scale: 2, alpha: 1 });
      p.dy -= Math.sin(ph * Math.PI) * 10;
      p.sy *= ph < 0.1 || ph > 0.9 ? 0.86 : 1.06; p.sx *= ph < 0.1 || ph > 0.9 ? 1.12 : 0.96;
      p.facing = Math.cos(t * Math.PI * 3) >= 0 ? 1 : -1;
      p.eyes = "happy"; p.mouth = "open";
      if (t > 0.8) {
        if (c.data.win !== false) for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2 + t * 4; const r = 14 + (t - 0.8) * 60;
          f.props.push({ sprite: "sparkle", x: Math.cos(ang) * r, y: -16 + Math.sin(ang) * r * 0.6, scale: 2, alpha: 1 - (t - 0.8) * 4 });
        }
        else f.props.push({ sprite: "drop", x: 12, y: -28 + (t - 0.8) * 20, scale: 1, alpha: 1 });
      }
      break;
    }
    case "wash": {
      // 물방울이 쏟아지고 거품이 올라옴 → 똥이 사라짐 → 반짝
      for (let i = 0; i < 7; i++) {
        const ph = (t * 2.2 + hash(i) ) % 1;
        if (t < 0.7) f.props.push({ sprite: "drop", x: (hash(i + 3) * 2 - 1) * 24, y: -60 + ph * 56, scale: 1, alpha: 0.9 });
      }
      for (let i = 0; i < 6; i++) {
        const ph = (t * 1.6 + hash(i + 10)) % 1;
        f.props.push({ sprite: "bubble", x: (hash(i + 20) * 2 - 1) * 20 + Math.sin(now / 200 + i) * 2, y: -4 - ph * 34, scale: 1, alpha: Math.sin(ph * Math.PI) * (t < 0.85 ? 1 : (1 - t) / 0.15) });
      }
      p.eyes = t < 0.7 ? "closed" : "happy"; p.mouth = "smile";
      p.dx += Math.sin(now / 50) * (t < 0.6 ? 0.8 : 0); // 부르르
      if (t > 0.7) for (let i = 0; i < 3; i++) f.props.push({ sprite: "sparkle", x: -14 + i * 14, y: -30 - Math.sin((t - 0.7) * 10 + i) * 4, scale: 2, alpha: 1 - (t - 0.7) * 3 });
      break;
    }
    case "lightOff":
    case "lightOn": {
      const on = c.type === "lightOn";
      const target = f.darkness, from = on ? (scene.asleep ? 0.62 : 0.62) : (scene.asleep ? 0.18 : 0);
      f.darkness = from + (target - from) * ease(t);
      if (!on && t < 0.7) { p.mouth = "open"; p.eyes = "closed"; } // 하품
      break;
    }
    case "medicine": {
      // 알약이 떨어져 꿀꺽 → 몸 꾹 → 반짝이 + 어지러움 사라짐
      const fall = ease(t / 0.35);
      if (t < 0.38) { f.props.push({ sprite: "iconMedicine", x: -5, y: -52 + fall * 32, scale: 1, alpha: 1 }); p.mouth = "open"; }
      else if (t < 0.6) { p.sy *= 0.88; p.sx *= 1.1; p.eyes = "closed"; p.mouth = "flat"; }
      else if (c.data.bitter) { // 안 아픈데 먹은 약: 퉤퉤
        p.eyes = "x"; p.mouth = "flat"; p.dx += Math.sin(t * Math.PI * 8) * 3 * (1 - t);
        f.props.push({ sprite: "puff", edge: 1, x: 2, y: -18 - (t - 0.6) * 20, scale: 2, alpha: 1 - (t - 0.6) * 2.5 });
      } else { p.eyes = "happy"; p.mouth = "smile"; p.dizzy = false; for (let i = 0; i < 3; i++) f.props.push({ sprite: "sparkle", x: -16 + i * 16, y: -34 - (t - 0.6) * 30, scale: 2, alpha: 1 - (t - 0.6) * 2.5 }); }
      break;
    }
    case "refuse": {
      // 고개를 도리도리 + 입 꾹
      p.dx += Math.sin(t * Math.PI * 6) * 6 * (1 - t);
      p.eyes = "x"; p.mouth = "flat";
      f.props.push({ sprite: "puff", edge: 1, x: 2, y: -20 - t * 10, scale: 2, alpha: 1 - t });
      break;
    }
    case "sleepyRefuse": {
      f.texts.push({ text: "Z", x: 4, y: -40 - t * 10, alpha: 1 - t, size: 12 });
      p.sx *= 1 + Math.sin(t * Math.PI) * 0.06;
      break;
    }
    case "pet": {
      // 쓰다듬기: 꾹 눌렸다 튀어 오르며 하트
      const sq = Math.sin(clamp01(t / 0.4) * Math.PI);
      p.sy *= 1 - sq * 0.14; p.sx *= 1 + sq * 0.12;
      if (t > 0.3) p.dy -= Math.sin(clamp01((t - 0.3) / 0.5) * Math.PI) * 5;
      p.eyes = "happy"; p.mouth = "smile";
      f.props.push({ sprite: "heart", x: 0, y: -30 - t * 26, scale: 2, alpha: 1 - t });
      break;
    }
    case "poop": {
      f.poopPop = Math.sin(t * Math.PI);
      if (!scene.asleep) { p.eyes = "closed"; p.sy *= 1 - Math.sin(t * Math.PI) * 0.06; }
      break;
    }
    case "hatch": {
      // 알이 점점 세게 흔들리고 금이 감 → 번쩍 → 아기가 톡 튀어나옴
      if (t < 0.72) {
        const k = t / 0.72;
        f.showKey = c.data.eggKey || "animal.egg";
        f.egg = { shake: Math.sin(now / (60 - k * 30)) * (0.5 + k * 3), cracks: k > 0.85 ? 3 : k > 0.6 ? 2 : k > 0.3 ? 1 : 0 };
      } else {
        f.flash = Math.max(0, 1 - (t - 0.72) / 0.18) * 0.85;
        const k = (t - 0.72) / 0.28;
        p.dy -= Math.sin(clamp01(k) * Math.PI) * 12; p.eyes = "happy"; p.mouth = "open";
        for (let i = 0; i < 6; i++) { const ang = (i / 6) * Math.PI * 2; const r = 10 + k * 30; f.props.push({ sprite: "sparkle", x: Math.cos(ang) * r, y: -14 + Math.sin(ang) * r * 0.7, scale: 2, alpha: 1 - k }); }
      }
      break;
    }
    case "evolve": {
      // 하얀 실루엣이 옛 모습 ↔ 새 모습으로 점점 빠르게 바뀜 → 번쩍 → 새 모습 공개 + 하트·반짝이 폭발
      if (t < 0.72) {
        const el = now - c.start;
        const rate = Math.max(70, 420 - (t / 0.72) * 360);
        const showNew = Math.floor(el / rate) % 2 === 1;
        f.showKey = showNew ? c.data.toKey : c.data.fromKey;
        f.silhouette = t > 0.08;
        p.sy *= 1 + Math.sin(el / 90) * 0.03;
        p.dy -= Math.min(4, t * 10); // 살짝 떠오름
      } else {
        f.flash = Math.max(0, 1 - (t - 0.72) / 0.14) * 0.9;
        const k = (t - 0.72) / 0.28;
        p.eyes = "happy"; p.mouth = "bigsmile"; p.dy -= Math.sin(clamp01(k) * Math.PI) * 8;
        for (let i = 0; i < 8; i++) { const ang = (i / 8) * Math.PI * 2; const r = 14 + k * 44; f.props.push({ sprite: i % 2 ? "sparkle" : "heart", x: Math.cos(ang) * r, y: -20 + Math.sin(ang) * r * 0.7, scale: 2, alpha: 1 - k }); }
      }
      break;
    }
    case "greet":
    case "greetBig": {
      // 반겨 주기: 화면 앞으로 다가와(조금 커짐) 콩콩 뛰고 하트
      const big = c.type === "greetBig";
      const near = Math.sin(clamp01(t / 0.25) * Math.PI / 2) * (t < 0.85 ? 1 : (1 - t) / 0.15);
      p.dx *= 1 - near; // 가운데로
      p.sx *= 1 + near * 0.15; p.sy *= 1 + near * 0.15;
      const hops = big ? 3 : 2;
      const ph = clamp01((t - 0.2) / 0.65) * hops;
      if (t > 0.2 && t < 0.85) p.dy -= Math.abs(Math.sin(ph * Math.PI)) * (big ? 12 : 8);
      p.eyes = "happy"; p.mouth = "bigsmile";
      const n = big ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const ht = clamp01((t - 0.25 - i * 0.08) / 0.6);
        if (ht > 0 && ht < 1) f.props.push({ sprite: "heart", x: (i - (n - 1) / 2) * 12, y: -36 - ht * 30, scale: 2, alpha: 1 - ht });
      }
      if (big && t > 0.3 && t < 0.8) f.texts.push({ text: "!", x: 16, y: -44, alpha: 1, size: 12 });
      break;
    }
    case "mgLook": {
      // 미니게임: 한쪽으로 휙 → 맞히면 신나고, 틀리면 갸웃
      const side = c.data.side || 1;
      p.facing = side; p.dx = side * 10 * ease(t / 0.25);
      if (t > 0.3) {
        if (c.data.correct) { p.eyes = "happy"; p.mouth = "bigsmile"; p.dy -= Math.sin(clamp01((t - 0.3) / 0.5) * Math.PI) * 6; f.props.push({ sprite: "sparkle", x: side * 14, y: -34, scale: 2, alpha: 1 - t }); }
        else { p.mouth = "o"; p.sx *= 1 + Math.sin(t * 20) * 0.03; f.texts.push({ text: "?", x: side * 16, y: -38, alpha: 1 - t * 0.6, size: 11 }); }
      }
      break;
    }
    case "farewell": {
      const how = c.data.how;
      if (how === "star") { // 하늘로 올라가며 사라지고 별이 반짝
        p.dy -= ease(t) * 70; f.petAlpha = 1 - clamp01((t - 0.4) / 0.5); p.eyes = "happy"; p.mouth = "smile";
        if (t > 0.6) f.props.push({ sprite: "bigStar", x: 0, y: -70, scale: 2, alpha: clamp01((t - 0.6) / 0.3) });
      } else { // 손 흔들고(뛰고) 오른쪽으로 걸어 나감, 편지가 남음
        const walk = clamp01((t - 0.25) / 0.65);
        if (t < 0.25) { p.dy -= Math.abs(Math.sin(t * 40)) * 3; p.eyes = how === "runaway" ? "closed" : "happy"; p.mouth = how === "runaway" ? "sad" : "smile"; }
        else { p.facing = 1; p.dx += walk * 140; p.dy -= Math.abs(Math.sin(now / 90)) * 2; p.eyes = how === "runaway" ? "closed" : null; }
        if (t > 0.3) f.props.push({ sprite: "letter", x: -p.dx, y: -2, scale: 2, alpha: clamp01((t - 0.3) / 0.2) });
      }
      break;
    }
    case "tidy": {
      // 똥 치웠을 때 펫 반응: 좋아서 몸을 흔듦
      p.eyes = "happy"; p.mouth = "smile";
      p.sx *= 1 + Math.sin(t * Math.PI * 4) * 0.05 * (1 - t);
      break;
    }  }
}
