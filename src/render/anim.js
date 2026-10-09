import { WALK_REACT } from "./walk-courses.js?v=5fa7d34-1791550867";
// 애니메이션 엔진. 게임 규칙과는 무관하게 "지금 화면에 어떻게 보일지"만 계산한다.
// - 한 번 재생(행동 반응, 부화, 진화): play(type, data)
// - 평소 움직임(깜빡임, 걸어 다니기, 숨쉬기)과 상태 표현(눈물, 어지러움, Zzz)은 매 프레임 계산
// 결과(frame)는 screen.js 가 그린다. 시간은 실제 시각(ms, performance.now) 기준.

export const DUR = {
  meal: 1800, snack: 1400, play: 2200, wash: 4400, mgHop: 450, butt: 3400, walk: 11000, tickle: 2000, lookFrame: 2600, eggPeek: 1800, wish: 2400, lightOff: 900, lightOn: 700,
  medicine: 1600, refuse: 900, sleepyRefuse: 1000, hatch: 2600, evolve: 3000, pet: 800, poop: 500,
  greet: 2200, greetBig: 3200, tidy: 700, mgLook: 1100, farewell: 3800, tuckIn: 1600, untuck: 1200,
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
    butt: { nextAt: 25000 + Math.random() * 20000 }, // 엉덩이춤(기분 좋을 때 가끔)
    lastT: 0,
    fx: [], // 화면 위치에 붙는 짧은 효과(똥 치우기 연기 등)
    minigame: false, // 미니게임 중이면 가운데에서 고민하는 자세
  };
}

export function addFx(a, type, x, y, now, dur = 600, extra = {}) {
  a.fx.push({ type, x, y, start: now, dur, ...extra });
}

const BED_ANIMS = new Set(["tuckIn", "untuck"]);
export function play(a, type, now, data = {}) {
  // 쿠션이 나타나는/사라지는 도중에 반대 동작이 오면, 지금 보이는 크기에서 이어서(두 번 생겼다 사라지는 것처럼 보이지 않게)
  if (BED_ANIMS.has(type) && a.cur && BED_ANIMS.has(a.cur.type) && busy(a, now)) data = { ...data, fromBed: a.lastBed ?? null, fromBlanket: a.lastBlanket ?? null };
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
    bed: 0, // 쿠션(0 없음 → 1), 낮잠·밤잠 모두
    blanket: 0, // 몸 위에 덮는 이불(0 → 1), 밤잠에만
    back: false, // 뒷모습(엉덩이춤)
    hat: null, // 특별한 날 모자
    tub: 0, // 씻기 욕조(0 없음 → 1)
    foam: 0, // 머리 위 거품(0 → 1)
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
  } else if (scene.asleep || scene.napping) {
    w.target = 0; // 잘 때는 가운데 쿠션으로
  } else if (!busy(a, now)) {
    w.target = w.x; // 멈춤
  }
  // 소파가 있으면 가끔 올라가 쉰다(9초). scene.sofaDx = 소파 자리(가운데 기준)
  if (scene.sofaDx != null && calm && !crying && !scene.sick && !a.minigame && !a.inGame) {
    if (!a.sofa) a.sofa = { nextAt: now + 15000 + hash(now * 0.9) * 20000, until: 0 };
    if (!busy(a, now) && now > a.sofa.nextAt && now > a.sofa.until) { a.sofa.until = now + 9000; a.sofa.nextAt = now + 50000 + hash(now * 1.7) * 60000; }
    if (now < a.sofa.until) { w.target = scene.sofaDx; w.nextAt = now + 1500; }
  } else if (a.sofa) a.sofa.until = 0;
  const diff = w.target - w.x;
  if (Math.abs(diff) > 0.3) {
    const step = Math.sign(diff) * Math.min(Math.abs(diff), (dt / 1000) * 14);
    w.x += step; w.facing = Math.sign(diff);
    p.dy -= Math.abs(Math.sin(now / 90)) * 1.5; // 통통 걷기
  }
  p.dx = w.x; p.facing = w.facing;
  f.onSofa = !!(a.sofa && now < a.sofa.until && scene.sofaDx != null && Math.abs(w.x - scene.sofaDx) < 1.5 && calm);
  if (f.onSofa) { p.dy += scene.sofaLift != null ? scene.sofaLift : -9; p.facing = -1; if (!p.eyes) p.eyes = Math.floor(now / 1600) % 4 === 0 ? "closed" : "happy"; p.mouth = p.mouth || "smile"; } // 소파 위에서 쉬기
  // 기분이 아주 좋으면 가끔 콩 뛰기
  if (calm && scene.mood > 80 && !busy(a, now) && now > a.hop.nextAt) { a.hop.at = now; a.hop.nextAt = now + 7000 + hash(now) * 6000; }
  // 기분이 아주 좋고 배도 부르면 가끔 엉덩이춤(놀이·행동 중엔 안 함)
  if (calm && !crying && !scene.sick && scene.mood >= 80 && scene.hunger >= 30 && !a.minigame && !a.inGame && !busy(a, now) && now > a.butt.nextAt) {
    a.butt.nextAt = now + 60000 + hash(now * 0.3) * 60000;
    play(a, "butt", now);
  }
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
    f.bed = 1;
    if (scene.asleep) f.blanket = 1; // 밤잠: 이불 덮음
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
  a.lastBed = f.bed; a.lastBlanket = f.blanket;
  return f;
}

// 산책 시간표: 0~0.06 문 나서기(하얗게), 걷다가 두 번 멈춰 무언가를 만나고, 0.94~1 집으로
export const WALK_STOPS = [[0.22, 0.44], [0.58, 0.8]];
const WALK_SPEED = 320; // 배경이 흐르는 양(t 1 동안 px)
export function walkDist(t) {
  let moving = t;
  for (const [a, b] of WALK_STOPS) moving -= Math.max(0, Math.min(t, b) - a);
  return moving * WALK_SPEED;
}

// 춤 모양: 엉덩이·꼬리가 있는 친구는 엉덩이춤, 고래는 지느러미, 슬라임·구름은 젤리
export function danceStyle(scene) {
  const { theme, stage, branch } = scene;
  if (theme !== "fantasy") return "butt";
  if (stage === "adult" && branch === "C") return "fin";
  if ((stage === "teen" && branch === "good") || (stage === "adult" && (branch === "A" || branch === "B"))) return "dragon";
  if (stage === "adult" && branch === "S") return "butt"; // 유니콘: 말꼬리
  return "jelly"; // 말랑이·뿔말랑이·꼬마 구름·번개 구름
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
      // 놀이 끝 신나는 동작: 매번 3종 중 하나(c.data.v) → 이기면 반짝, 지면 땀방울
      const v = c.data.v || "ball";
      p.eyes = "happy"; p.mouth = "open";
      if (v === "ball") { // 공이 통통 튀고 따라 점프
        const ph = (t * 3) % 1;
        const ballX = Math.sin(t * Math.PI * 3) * 22;
        const ballY = -Math.abs(Math.sin(t * Math.PI * 6)) * 26;
        if (t < 0.85) f.props.push({ sprite: "ball", edge: Math.sign(ballX) || 1, x: Math.abs(ballX) * Math.sign(ballX || 1) * 0.6 + 6 * (Math.sign(ballX) || 1), y: ballY, scale: 2, alpha: 1 });
        p.dy -= Math.sin(ph * Math.PI) * 10;
        p.sy *= ph < 0.1 || ph > 0.9 ? 0.86 : 1.06; p.sx *= ph < 0.1 || ph > 0.9 ? 1.12 : 0.96;
        p.facing = Math.cos(t * Math.PI * 3) >= 0 ? 1 : -1;
      } else if (v === "spin") { // 빙글빙글 돌기: 좌우가 빠르게 바뀌며 납작해졌다 돌아옴, 음표
        const k = clamp01(t / 0.8);
        const turn = Math.cos(k * Math.PI * 6);
        p.facing = turn >= 0 ? 1 : -1; p.sx *= 0.55 + Math.abs(turn) * 0.45;
        p.dy -= Math.sin(k * Math.PI) * 6;
        if (t > 0.8) { p.sx *= 1; p.mouth = "bigsmile"; }
        for (let i = 0; i < 2; i++) { const ph = ((t * 2) + i / 2) % 1; f.texts.push({ text: "♪", x: (i ? 18 : -18) + Math.sin(ph * 6) * 2, y: -30 - ph * 14, alpha: Math.sin(ph * Math.PI), size: 9 }); }
      } else { // dance: 좌우로 흔들흔들 + 콩콩, 음표
        const sway = Math.sin(t * Math.PI * 6);
        p.dx += sway * 6; p.facing = sway >= 0 ? 1 : -1;
        p.sx *= 1 + Math.abs(sway) * 0.05; p.sy *= 1 - Math.abs(sway) * 0.05;
        p.dy -= Math.abs(Math.cos(t * Math.PI * 6)) * 3;
        p.mouth = Math.floor(t * 6) % 2 ? "cat" : "open";
        for (let i = 0; i < 3; i++) { const ph = ((t * 1.6) + i / 3) % 1; f.texts.push({ text: i % 2 ? "♫" : "♪", x: -22 + i * 22, y: -34 - ph * 12, alpha: Math.sin(ph * Math.PI), size: 9 }); }
      }
      if (t > 0.8) {
        if (c.data.win !== false) for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2 + t * 4; const r = 14 + (t - 0.8) * 60;
          f.props.push({ sprite: "sparkle", x: Math.cos(ang) * r, y: -16 + Math.sin(ang) * r * 0.6, scale: 2, alpha: 1 - (t - 0.8) * 4 });
        }
        else f.props.push({ sprite: "drop", x: 12, y: -28 + (t - 0.8) * 20, scale: 1, alpha: 1 });
      }
      break;
    }
    case "butt": {
      // 기분 좋을 때 춤. 몸 모양에 맞게: 엉덩이가 있는 친구는 뒤돌아 엉덩이·꼬리 씰룩,
      // 고래는 지느러미 파닥·꼬리지느러미 살랑·물 뿜기, 슬라임·구름은 말랑말랑 젤리 춤
      const style = danceStyle(scene);
      const ph = (t - 0.08) * Math.PI * 14, w = Math.sin(ph);
      for (let i = 0; i < 3; i++) { const q = ((t * 2.2) + i / 3) % 1; if (t > 0.08 && t < 0.86) f.texts.push({ text: i % 2 ? "♫" : "♪", x: -24 + i * 24, y: -36 - q * 14, alpha: Math.sin(q * Math.PI), size: 9 }); }
      if (style === "fin") {
        if (t < 0.86) {
          f.wag = Math.sin(t * Math.PI * 12); // 지느러미·꼬리지느러미 파닥
          p.dy -= Math.abs(Math.sin(t * Math.PI * 6)) * 3; p.dx += Math.sin(t * Math.PI * 3) * 2;
          p.eyes = "happy"; p.mouth = Math.floor(t * 8) % 2 ? "bigsmile" : "smile";
          for (let i = 0; i < 6; i++) { const q = ((t * 2.5) + i / 6) % 1; f.props.push({ sprite: "drop", x: (p.facing || 1) * 6 + Math.cos(i * 1.1) * q * 14, y: -40 - Math.sin(q * Math.PI) * 18 + q * 6, scale: 1, alpha: 1 - q }); } // 물 뿜기
          if (t > 0.3 && t < 0.6) f.texts.push({ text: "파닥파닥", x: 0, y: -52, alpha: 1, size: 8 });
        } else { p.eyes = "happy"; p.mouth = "tongue"; f.props.push({ sprite: "heart", x: 14, y: -34 - (t - 0.86) * 60, scale: 2, alpha: 1 }); }
        break;
      }
      if (style === "jelly") {
        if (t < 0.86) {
          p.sx *= 1 + w * 0.14; p.sy *= 1 - w * 0.14; // 말랑말랑
          p.dy -= Math.max(0, -w) * 4; p.dx += Math.sin(ph / 2) * 3;
          p.eyes = "happy"; p.mouth = Math.floor(t * 8) % 2 ? "cat" : "open";
          if (t > 0.3 && t < 0.6) f.texts.push({ text: "말랑말랑", x: 0, y: -50, alpha: 1, size: 8 });
        } else { p.eyes = "happy"; p.mouth = "tongue"; f.props.push({ sprite: "heart", x: 14, y: -34 - (t - 0.86) * 60, scale: 2, alpha: 1 }); }
        break;
      }
      // 엉덩이춤(뒤돌아 씰룩씰룩)
      const turnIn = t < 0.1, turnOut = t > 0.82;
      if (turnIn || (turnOut && t < 0.9)) { p.sx *= 0.6; p.eyes = "closed"; } // 도는 순간 납작
      if (t >= 0.08 && t < 0.86) {
        f.back = true; f.tailKind = style === "dragon" ? "own" : "fluffy"; // 용은 원래 그림의 꼬리
        p.dx += w * 3; p.sx *= 1 + Math.abs(w) * 0.06; p.sy *= 1 - Math.abs(w) * 0.05;
        p.dy -= Math.abs(Math.cos(ph)) * 1.5;
        f.tailWag = w;
        if (t > 0.3 && t < 0.6) f.texts.push({ text: "씰룩씰룩", x: 0, y: -50, alpha: 1, size: 8 });
      }
      if (t >= 0.9) { p.eyes = "happy"; p.mouth = "tongue"; f.props.push({ sprite: "heart", x: 14, y: -34 - (t - 0.9) * 60, scale: 2, alpha: 1 }); }
      break;
    }
    case "walk": {
      const evs = c.data.events || [];
      let cur = null;
      WALK_STOPS.forEach(([a, b], i) => { if (t >= a && t < b && evs[i]) cur = { i, kind: WALK_REACT[evs[i].kind] || evs[i].kind, k: (t - a) / (b - a) }; }); // 코스마다 다른 것도 반응은 공원 4가지 중 하나
      f.walk = { t, dist: walkDist(t), events: evs, cur, season: c.data.season || null, course: c.data.course || "park", winter: !!c.data.winter, fade: t < 0.06 ? 1 - t / 0.06 : t > 0.94 ? (t - 0.94) / 0.06 : 0 };
      p.facing = 1; p.dx = 0;
      if (!cur) { p.dy -= Math.abs(Math.sin(now / 110)) * 2.5; p.eyes = p.eyes || null; p.mouth = "smile"; } // 통통 걷기
      else {
        const k = cur.k;
        if (cur.kind === "butterfly") { // 올려다보다가 콩
          p.eyes = k < 0.45 ? "round" : "happy"; p.mouth = k < 0.45 ? "o" : "bigsmile";
          if (k > 0.45 && k < 0.8) p.dy -= Math.sin(((k - 0.45) / 0.35) * Math.PI) * 9;
        } else if (cur.kind === "flower") { // 킁킁 → 하트
          if (k < 0.6) { p.eyes = "closed"; p.mouth = "o"; p.sx *= 1 + Math.sin(now / 90) * 0.02; f.texts.push({ text: "킁킁", x: 16, y: -36, alpha: 1, size: 8 }); }
          else { p.eyes = "happy"; p.mouth = "smile"; f.props.push({ sprite: "heart", x: 4, y: -36 - (k - 0.6) * 40, scale: 2, alpha: 1 - (k - 0.6) * 2 }); }
        } else if (cur.kind === "puddle") { // 폴짝 → 첨벙!
          if (k > 0.15 && k < 0.5) { p.dy -= Math.sin(((k - 0.15) / 0.35) * Math.PI) * 12; p.eyes = "happy"; p.mouth = "open"; }
          else if (k >= 0.5) { p.eyes = k < 0.7 ? "closed" : "happy"; p.mouth = "bigsmile"; if (k < 0.62) { p.sy *= 0.86; p.sx *= 1.1; } f.texts.push({ text: "첨벙!", x: 0, y: -44, alpha: Math.min(1, (1 - k) * 4), size: 9 }); }
        } else if (cur.kind === "friend") { // 친구와 인사: 콩콩 + 하트
          p.eyes = "happy"; p.mouth = "bigsmile"; p.dy -= Math.abs(Math.sin(k * Math.PI * 3)) * 5;
          if (k > 0.2) f.texts.push({ text: "안녕!", x: 6, y: -44, alpha: Math.min(1, (k - 0.2) * 5), size: 9 });
        }
      }
      break;
    }
    case "tickle": {
      // 간지럼: 꺄르르 데굴데굴(좌우로 크게 기울며 굴러감)
      const k = Math.sin(t * Math.PI * 5);
      p.dx += k * 7; p.facing = k >= 0 ? 1 : -1;
      p.sx *= 1 + Math.abs(k) * 0.12; p.sy *= 1 - Math.abs(k) * 0.12;
      p.dy -= Math.abs(Math.sin(t * Math.PI * 10)) * 3;
      p.eyes = "happy"; p.mouth = Math.floor(t * 12) % 2 ? "bigsmile" : "open";
      for (let i = 0; i < 2; i++) { const ph = ((t * 3) + i / 2) % 1; f.texts.push({ text: "ㅋ", x: (i ? 16 : -16) + Math.sin(ph * 8) * 2, y: -30 - ph * 12, alpha: 1 - ph, size: 9 }); }
      if (t > 0.5) f.texts.push({ text: "간지러워요!", x: 0, y: -50, alpha: Math.min(1, (t - 0.5) * 4), size: 8 });
      break;
    }
    case "lookFrame": {
      // 그리운 친구: 액자(오른쪽 위) 쪽을 올려다보며 "○○ 보고 싶다…"
      p.facing = 1; p.dx += ease(t / 0.3) * 10;
      p.eyes = t < 0.6 ? "round" : "happy"; p.mouth = t < 0.6 ? "o" : "bigsmile";
      if (t > 0.25) f.texts.push({ text: `${c.data.name || "친구"} 잘 지내나? 놀러 가고 싶다!`, x: 0, y: -48, alpha: Math.min(1, (t - 0.25) * 4), size: 8 });
      if (t > 0.6) f.props.push({ sprite: "heart", x: 18, y: -38 - (t - 0.6) * 40, scale: 2, alpha: 1 - (t - 0.6) * 2 });
      break;
    }
    case "eggPeek": {
      // 알의 인사: 콩콩 흔들리다가 "…안녕?" 하트
      f.egg = { shake: Math.sin(t * Math.PI * 8) * 2.5 * (t < 0.6 ? 1 : 0.3), cracks: 0 };
      if (t > 0.35) f.texts.push({ text: "…안녕?", x: 0, y: -44, alpha: Math.min(1, (t - 0.35) * 5), size: 9 });
      if (t > 0.6) f.props.push({ sprite: "heart", x: 0, y: -48 - (t - 0.6) * 40, scale: 2, alpha: 1 - (t - 0.6) * 2 });
      break;
    }
    case "wish": {
      // 11:11 소원 시간: 반짝반짝
      p.eyes = "sparkle"; p.mouth = "smile";
      for (let i = 0; i < 5; i++) { const ang = (i / 5) * Math.PI * 2 + t * 5; f.props.push({ sprite: "sparkle", x: Math.cos(ang) * 22, y: -20 + Math.sin(ang) * 14, scale: 2, alpha: 1 - Math.max(0, t - 0.7) * 3 }); }
      f.texts.push({ text: c.data.text || "소원 시간!", x: 0, y: -52, alpha: 1, size: 8 });
      break;
    }
    case "mgHop": {
      // 놀이 중 맞혔을 때 콩
      p.dy -= Math.sin(t * Math.PI) * 8; p.eyes = "happy"; p.mouth = "bigsmile";
      if (t < 0.15 || t > 0.85) { p.sy *= 0.9; p.sx *= 1.08; }
      break;
    }
    case "wash": {
      // 욕조 등장 → 거품 몽글몽글·오리 동동·음표 → 샤워로 헹굼 → 욕조 사라짐 → 부르르 털기 → 반짝 "뽀득!"
      const tubIn = ease(t / 0.1), tubOut = 1 - ease((t - 0.66) / 0.08);
      f.tub = Math.min(tubIn, tubOut);
      f.foam = t < 0.12 ? 0 : t < 0.5 ? ease((t - 0.12) / 0.16) : 1 - ease((t - 0.5) / 0.14);
      if (t < 0.66) { // 욕조 안
        p.eyes = t < 0.5 ? (Math.floor(now / 900) % 3 ? "happy" : "closed") : "closed";
        p.mouth = t < 0.5 ? (Math.floor(now / 500) % 2 ? "smile" : "cat") : "o";
        p.dx += Math.sin(now / 320) * 1.5; // 흔들흔들
        p.sx *= 1 + Math.sin(now / 320) * 0.02;
        if (t > 0.14 && t < 0.5) { // 비눗방울 둥실, 음표
          for (let i = 0; i < 5; i++) { const ph = (t * 2.4 + hash(i + 10)) % 1; f.props.push({ sprite: "bubble", x: (hash(i + 20) * 2 - 1) * 22 + Math.sin(now / 200 + i) * 2, y: -24 - ph * 30, scale: 1, alpha: Math.sin(ph * Math.PI) }); }
          const ph = (t * 3) % 1; f.texts.push({ text: "♪", x: -20, y: -36 - ph * 10, alpha: Math.sin(ph * Math.PI), size: 9 });
        }
        if (t > 0.48 && t < 0.66) { // 샤워
          for (let i = 0; i < 9; i++) { const ph = (t * 6 + hash(i)) % 1; f.props.push({ sprite: "drop", x: (hash(i + 3) * 2 - 1) * 20, y: -70 + ph * 50, scale: 1, alpha: 0.9 }); }
        }
      } else if (t < 0.88) { // 부르르 털기 + 물방울 양옆으로
        const k = (t - 0.66) / 0.22;
        p.dx += Math.sin(now / 28) * 2.4 * (1 - k * 0.5);
        p.sx *= 1 + Math.sin(now / 28) * 0.06; p.eyes = "closed"; p.mouth = "wavy";
        for (let i = 0; i < 8; i++) { const ph = (k * 2.2 + hash(i + 40)) % 1, sg = i % 2 ? 1 : -1; f.props.push({ sprite: "drop", x: sg * (14 + ph * 26), y: -14 - hash(i + 50) * 18 - Math.sin(ph * Math.PI) * 8 + ph * 10, scale: 1, alpha: 1 - ph }); }
      } else { // 반짝 뽀득
        const k = (t - 0.88) / 0.12;
        p.eyes = "sparkle"; p.mouth = "bigsmile"; p.dy -= Math.sin(k * Math.PI) * 4;
        for (let i = 0; i < 3; i++) f.props.push({ sprite: "sparkle", x: -16 + i * 16, y: -30 - Math.sin(k * 6 + i) * 4, scale: 2, alpha: 1 - k * 0.5 });
        f.texts.push({ text: "뽀득!", x: 0, y: -46 - k * 4, alpha: 1, size: 9 });
      }
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
    case "tuckIn": {
      // 잠들 때: 쿠션이 톡 → 이불이 아래에서 스르륵 올라와 덮음
      const b0 = c.data.fromBed ?? 0, k0 = c.data.fromBlanket ?? 0; // 깨는 도중이었으면 그 크기에서 이어서
      f.bed = Math.max(0.001, b0 + (1 - b0) * ease(clamp01(t / 0.5)));
      f.blanket = c.data.night ? k0 + (1 - k0) * ease(clamp01((t - 0.35) / 0.65)) : 0; // 쿠션이 먼저, 이불은 그다음(밤잠만)
      if (t < 0.35) { p.eyes = "closed"; p.mouth = "yawn"; } // 하품
      break;
    }
    case "untuck": {
      // 깰 때: 기지개 켜며 이불이 내려가고 쿠션이 사라짐
      const b0 = c.data.fromBed ?? 1, k0 = c.data.fromBlanket ?? 1; // 잠드는 도중이었으면 그 크기에서 줄어듦
      f.bed = b0 * (1 - ease(clamp01((t - 0.3) / 0.7)));
      f.blanket = c.data.night ? k0 * (1 - ease(clamp01(t / 0.5))) : 0; // 이불 먼저 걷고 쿠션이 사라짐
      p.sy *= 1 + Math.sin(clamp01(t / 0.6) * Math.PI) * 0.12; p.sx *= 1 - Math.sin(clamp01(t / 0.6) * Math.PI) * 0.06;
      p.eyes = t < 0.5 ? "closed" : null; p.mouth = t < 0.5 ? "yawn" : null;
      break;
    }
    case "tidy": {
      // 똥 치웠을 때 펫 반응: 좋아서 몸을 흔듦
      p.eyes = "happy"; p.mouth = "smile";
      p.sx *= 1 + Math.sin(t * Math.PI * 4) * 0.05 * (1 - t);
      break;
    }  }
}
