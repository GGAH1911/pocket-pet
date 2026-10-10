// 놀이(미니게임) 4종. 화면·DOM과 분리된 순수 로직: 시각(ms)과 입력만 받아 상태를 바꾸고,
// 그릴 물체·펫 자세·안내 문구를 돌려준다. main.js가 이어 붙이고, 결과(승/패)는 sim.play로 넘긴다.
// L(배치): { w, h, cx, baseY, headY } — 캔버스 논리 좌표. 물체 x는 가운데, y는 바닥 기준.

export const GAMES = ["side", "bubbles", "hide", "catch"]; // 기본(무료)
// 산 놀이(2026-10-09 사용자 "놀이 종류를 더 넣어줘, 구매 가능한 상품", 게임·경제·아동 심리 자문): 모두 '보이는 것 중 하나를 탭' 5판 3승
export const EXTRA_GAMES = ["snack", "face", "odd", "tidy", "count"];
export const GAME_NAMES = { side: "어느 쪽?", bubbles: "비눗방울 톡톡", hide: "숨바꼭질", catch: "공 받기",
  snack: "좋아하는 간식", face: "표정 맞히기", odd: "다른 걸 찾아요", tidy: "제자리 찾아 주기", count: "몇 개일까요?" };
export const GAME_DESC = {
  snack: "친구가 생각하는 간식을 골라 줘요", face: "친구 표정을 보고 기분을 맞혀요", odd: "하나만 다른 별을 찾아 톡",
  tidy: "장난감은 장난감 통, 책은 책장으로", count: "별이 몇 개인지 세어 봐요",
};

// 바로 앞 놀이는 연달아 안 나오게 무작위로 고른다. extra = 산 놀이 목록(무작위에 섞임)
export function pickGame(last, rnd = Math.random, extra = []) {
  const pool = [...GAMES, ...extra].filter((g) => g !== last);
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
}

export function createGame(kind, now, rnd = Math.random) {
  const make = { side: sideGame, bubbles: bubbleGame, hide: hideGame, catch: catchGame, snack: snackGame, face: faceGame, odd: oddGame, tidy: tidyGame, count: countGame }[kind];
  if (!make) throw new Error(`없는 놀이: ${kind}`);
  return make(now, rnd);
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const dots = (n, results) => Array.from({ length: n }, (_, i) => (i < results.length ? (results[i] ? "hit" : "miss") : ""));

// ---------- 어느 쪽? ----------
function sideGame(start, rnd) {
  const g = { kind: "side", buttons: ["◀ 왼쪽", "오른쪽 ▶"], results: [], waitUntil: 0, msg: "" };
  g.press = (i, now) => {
    if (now < g.waitUntil || g.results.length >= 5) return null;
    const side = i === 0 ? -1 : 1, petSide = rnd() < 0.5 ? -1 : 1, ok = side === petSide;
    g.results.push(ok); g.waitUntil = now + 1200;
    g.msg = ok ? "맞혔어요!" : `아쉬워요, ${petSide < 0 ? "왼쪽" : "오른쪽"}을 봤어요`;
    return { sfx: ok ? "right" : "wrong", anim: ["mgLook", { side: petSide, correct: ok }] };
  };
  g.status = (now) => {
    const n = g.results.length, correct = g.results.filter(Boolean).length;
    const text = now < g.waitUntil ? g.msg : n === 0 ? "어느 쪽을 볼까요? 맞혀 보세요!" : `${n + 1}번째 · 어느 쪽을 볼까요?`;
    return { text, dots: dots(5, g.results), done: n >= 5 && now >= g.waitUntil, win: correct >= 3, score: `${correct}번 맞혔어요`, enabled: now >= g.waitUntil };
  };
  g.objects = () => [];
  g.pet = () => ({ think: true });
  return g;
}

// ---------- 비눗방울 톡톡 ----------
// 바닥에서 방울이 올라온다. 톡 눌러 터뜨리면 1개. 8개 이상이면 승리.
const BUBBLE_GOAL = 8, BUBBLE_N = 18;
function bubbleGame(start, rnd) {
  const list = Array.from({ length: BUBBLE_N }, (_, i) => ({
    born: start + 600 + i * 620 + rnd() * 250, fx: 0.1 + rnd() * 0.8, speed: 15 + rnd() * 10, ph: rnd() * 6, popped: 0,
  }));
  const end = list[list.length - 1].born + 9000; // 마지막 방울이 다 올라갈 때까지
  const g = { kind: "bubbles", buttons: [], count: 0, chaseX: 0, bursts: [] };
  const pos = (b, now, L) => {
    const age = (now - b.born) / 1000;
    return { x: b.fx * L.w + Math.sin(age * 2.2 + b.ph) * 5, y: L.baseY - 4 - age * b.speed };
  };
  const alive = (b, now, L) => now >= b.born && !b.popped && pos(b, now, L).y > L.h * 0.06 + 18;
  g.tap = (x, y, now, L) => {
    let best = null, bd = 15 * 15;
    for (const b of list) {
      if (!alive(b, now, L)) continue;
      const p = pos(b, now, L), d = (p.x - x) ** 2 + (p.y - 9 - y) ** 2; // 방울 가운데 = 바닥에서 9 위
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) return null;
    const p = pos(best, now, L);
    best.popped = now; g.count++; g.chaseX = Math.max(-L.w * 0.32, Math.min(L.w * 0.32, p.x - L.cx));
    g.bursts.push({ x: p.x, y: p.y - 9, at: now });
    return { sfx: "right", anim: ["mgHop", {}] };
  };
  g.status = (now) => {
    const left = list.some((b) => now < b.born) || now < end;
    const text = now < start + 1200 ? "비눗방울을 톡톡 터뜨려요!" : g.count >= BUBBLE_GOAL ? `${g.count}개! 더 터뜨려도 돼요` : `톡톡! ${g.count}개 (${BUBBLE_GOAL}개 목표)`;
    return { text, dots: Array.from({ length: BUBBLE_GOAL }, (_, i) => (i < g.count ? "hit" : "")), done: !left, win: g.count >= BUBBLE_GOAL, score: `방울 ${g.count}개를 터뜨렸어요`, enabled: true };
  };
  g.objects = (now, L) => {
    const out = [];
    for (const b of list) if (alive(b, now, L)) { const p = pos(b, now, L); out.push({ sprite: "bigBubble", x: p.x, y: p.y, scale: 2, alpha: clamp01((now - b.born) / 300) }); }
    g.bursts = g.bursts.filter((s) => now - s.at < 400);
    for (const s of g.bursts) { const k = (now - s.at) / 400; out.push({ sprite: "sparkle", x: s.x, y: s.y + 5 - k * 6, scale: 2, alpha: 1 - k }); }
    return out;
  };
  g.pet = () => ({ chaseX: g.chaseX });
  // 끝이 너무 늘어지지 않게: 남은 방울이 없고 더 나올 것도 없으면 바로 끝
  const baseStatus = g.status;
  g.status = (now, L) => {
    const st = baseStatus(now);
    if (L && !st.done && now > list[list.length - 1].born && !list.some((b) => alive(b, now, L))) st.done = true;
    return st;
  };
  return g;
}

// ---------- 숨바꼭질 ----------
// 펫이 세 곳 중 한 곳에 숨는다. 3판 중 2번 찾으면 승리.
export const HIDE_SPOTS = [
  { label: "상자", sprite: "box", off: -0.34 },
  { label: "바구니", sprite: "basket", off: 0 },
  { label: "화분", sprite: "plant", off: 0.34 },
];
function hideGame(start, rnd) {
  const g = { kind: "hide", buttons: HIDE_SPOTS.map((s) => s.label), results: [], round: 0, phase: "ready", phaseAt: start, answer: 0, pick: -1, wiggle: [] };
  const newRound = (now) => {
    g.phase = "ready"; g.phaseAt = now; g.pick = -1; g.answer = Math.floor(rnd() * 3);
    g.wiggle = Array.from({ length: 4 }, () => ({ i: Math.floor(rnd() * 3), at: 1600 + rnd() * 3000 })); // 아무 데나 들썩(정답과 무관)
  };
  newRound(start);
  const step = (now) => {
    if (g.phase === "ready" && now - g.phaseAt > 2000) { g.phase = "seek"; g.phaseAt = now; }
    if (g.phase === "reveal" && now - g.phaseAt > 1600) {
      g.round++;
      if (g.round < 3) newRound(now); else { g.phase = "end"; g.phaseAt = now; }
    }
  };
  g.press = (i, now) => {
    step(now);
    if (g.phase !== "seek") return null;
    g.pick = i; g.phase = "reveal"; g.phaseAt = now;
    const ok = i === g.answer; g.results.push(ok);
    return { sfx: ok ? "right" : "wrong", anim: ok ? ["mgHop", {}] : null };
  };
  // 화면 속 물건을 직접 눌러도 고를 수 있다(물건 폭 36·높이 30~36 근처)
  g.tap = (x, y, now, L) => {
    const i = HIDE_SPOTS.findIndex((s) => Math.abs(x - (L.cx + s.off * L.w)) <= 20 && y <= L.baseY + 6 && y >= L.baseY - 40);
    return i >= 0 ? g.press(i, now) : null;
  };
  g.status = (now) => {
    step(now);
    const correct = g.results.filter(Boolean).length;
    const text = g.phase === "ready" ? (g.round === 0 ? "숨바꼭질! 숨을게요, 하나 둘 셋…" : "한 번 더! 숨을게요…")
      : g.phase === "seek" ? "어디에 숨었을까요?"
      : g.phase === "reveal" ? (g.pick === g.answer ? "짠! 찾았어요!" : `텅~ ${HIDE_SPOTS[g.answer].label} 뒤에 있었어요`)
      : "다 했어요!";
    return { text, dots: dots(3, g.results), done: g.phase === "end", win: correct >= 2, score: `${correct}번 찾았어요`, enabled: g.phase === "seek" };
  };
  g.objects = (now, L) => {
    step(now);
    const k = g.phase === "ready" ? clamp01((now - g.phaseAt - 1300) / 400) : 1; // 펫이 숨은 뒤 물건이 나타남
    const out = [];
    HIDE_SPOTS.forEach((s, i) => {
      let dy = 0, dx = 0;
      if (g.phase === "seek") for (const w of g.wiggle) { const t = now - g.phaseAt - w.at; if (w.i === i && t > 0 && t < 260) { dy = -Math.abs(Math.sin(t / 40)) * 2; dx = Math.sin(t / 30); } }
      out.push({ sprite: s.sprite, x: L.cx + s.off * L.w + dx, y: L.baseY + 2 + dy, scale: 3, alpha: k });
    });
    if (g.phase === "reveal" && g.pick !== g.answer && g.pick >= 0) out.push({ text: "텅~", x: L.cx + HIDE_SPOTS[g.pick].off * L.w, y: L.baseY - 36, size: 9 });
    return out;
  };
  g.pet = (now, L) => {
    step(now);
    if (g.phase === "ready") {
      const t = now - g.phaseAt;
      if (t < 1200) return { dx: 0, eyes: "closed", mouth: "smile", dy: t > 1000 ? -(t - 1000) / 25 : 0 }; // 눈 감고 하나 둘 셋 → 폴짝
      return { dx: 0, hidden: true };
    }
    if (g.phase === "seek" || g.phase === "end") return { hidden: true };
    // reveal: 정답 자리에서 쏙 튀어나옴(물건이 앞에 그려져서 얼굴만 빼꼼)
    const t = clamp01((now - g.phaseAt) / 280);
    const ok = g.pick === g.answer;
    const bob = t >= 1 ? Math.sin((now - g.phaseAt) / 160) * 1.5 : 0;
    return { dx: HIDE_SPOTS[g.answer].off * L.w, dy: 20 - t * 36 + bob, eyes: ok ? "happy" : "closed", mouth: ok ? "bigsmile" : "tongue" }; // 물건 위로 쏙(얼굴이 보이게)
  };
  return g;
}

// ---------- 공 받기 ----------
// 공이 날아와 머리 위 동그라미에 들어올 때 '잡아!'. 5번 중 3번 잡으면 승리.
const FLIGHT = 1700, GAP = 700, CATCH_R = 13; // 공이 동그라미에서 CATCH_R 안이면 잡을 수 있음
function catchGame(start, rnd) {
  const g = { kind: "catch", buttons: ["잡아!"], results: [], throwAt: start + 900, from: rnd() < 0.5 ? -1 : 1, resolved: null, resolvedAt: 0, msg: "" };
  const u = (now) => (now - g.throwAt) / FLIGHT;
  const step = (now) => {
    if (g.results.length >= 5) return;
    if (!g.resolved && u(now) >= 1) { g.resolved = "bonk"; g.resolvedAt = now; g.results.push(false); g.msg = "콩! 놓쳤어요"; g.bonkNew = true; }
    if (g.resolved && now - g.resolvedAt > 900 && g.results.length < 5) {
      g.resolved = null; g.throwAt = now + GAP; g.from = rnd() < 0.5 ? -1 : 1; g.msg = "";
    }
  };
  g.press = (_i, now, L) => {
    step(now);
    if (g.results.length >= 5 || g.resolved || u(now) < 0) return null;
    const k = u(now);
    if (L && inRing(k, L)) { g.resolved = "caught"; g.resolvedAt = now; g.results.push(true); g.msg = "잡았다!"; return { sfx: "right", anim: ["mgHop", {}] }; }
    g.resolved = "early"; g.resolvedAt = now + (1 - k) * FLIGHT; g.results.push(false); g.msg = "앗, 너무 빨랐어요"; // 공은 계속 날아와 머리에 콩
    return { sfx: "wrong" };
  };
  g.status = (now) => {
    step(now);
    const correct = g.results.filter(Boolean).length;
    const text = g.msg || (now < g.throwAt ? (g.results.length === 0 ? "공이 와요! 동그라미가 노래지면 '잡아!'" : `${g.results.length + 1}번째 공!`) : "지금…?");
    return { text, dots: dots(5, g.results), done: g.results.length >= 5 && now - g.resolvedAt > 900, win: correct >= 3, score: `${correct}번 잡았어요`, enabled: !g.resolved && now >= g.throwAt };
  };
  // 공 가운데 위치. 끝에서 느려지게(easeOut) 해서 누를 틈을 준다. 끝점 = 동그라미 가운데
  const ringY = (L) => L.headY - 1;
  const ballPos = (k, L) => {
    const e = 1 - (1 - clamp01(k)) ** 2;
    const x0 = L.cx + g.from * L.w * 0.48, y0 = ringY(L) - 34, x1 = L.cx, y1 = ringY(L);
    return { x: x0 + (x1 - x0) * e, y: y0 + (y1 - y0) * e - Math.sin(Math.PI * e) * 26 };
  };
  const inRing = (k, L) => { if (k < 0 || k > 1) return false; const b = ballPos(k, L); return Math.hypot(b.x - L.cx, b.y - ringY(L)) <= CATCH_R; };
  g.ballPos = ballPos;
  g.objects = (now, L) => {
    step(now);
    const out = [];
    const k = u(now);
    const glow = !g.resolved && inRing(k, L);
    if (g.results.length < 5 || g.resolved) out.push({ sprite: glow ? "ringOn" : "ring", x: L.cx, y: ringY(L) + 5, scale: 2, alpha: glow ? 1 : 0.8 });
    if (k >= 0 && k <= 1 && g.resolved !== "caught") out.push({ sprite: "ball", x: ballPos(k, L).x, y: ballPos(k, L).y + 8, scale: 2, alpha: 1 });
    if ((g.resolved === "bonk" || g.resolved === "early") && now > g.resolvedAt) { // 머리에 콩 맞고 튕겨 나감
      const t = (now - g.resolvedAt) / 900;
      out.push({ sprite: "ball", x: L.cx - g.from * t * L.w * 0.4, y: L.headY + 8 - Math.sin(Math.PI * Math.min(1, t * 1.4)) * 24 + Math.max(0, t - 0.7) * 120, scale: 2, alpha: 1 - Math.max(0, t - 0.8) * 5 });
      if (t < 0.4) out.push({ text: "콩!", x: L.cx + 12, y: L.headY - 4, size: 9 });
    }
    if (g.resolved === "caught") { const t = (now - g.resolvedAt) / 600; if (t < 1) out.push({ sprite: "sparkle", x: L.cx, y: L.headY - t * 10, scale: 2, alpha: 1 - t }); }
    return out;
  };
  g.pet = (now, L) => {
    step(now);
    const k = u(now);
    if (g.resolved === "caught" && now - g.resolvedAt < 700) return { center: true, eyes: "happy", mouth: "bigsmile" };
    if ((g.resolved === "bonk" || g.resolved === "early") && now > g.resolvedAt && now - g.resolvedAt < 600) return { center: true, eyes: "x", mouth: "o", squish: 1 };
    if (k >= 0 && k <= 1 && !g.resolved) return { center: true, mouth: "o", facing: k < 0.5 ? g.from : 1 };
    return { center: true };
  };
  return g;
}

// ---------- 산 놀이 5종 공통 틀: 5판, 판마다 보기 중 하나 고르기, 3번 맞히면 승리 ----------
// round(rnd) → { answer, ...판 정보 }. 버튼(labels) 또는 캔버스 탭(hitTest)으로 고름
function pickRounds(kind, start, rnd, { labels, intro, makeRound, objects, pet, hitTest, right = "맞았어요!", wrong }) {
  const g = { kind, buttons: labels || [], results: [], round: null, waitUntil: start + 900, msg: "", pick: -1 };
  const next = () => { g.round = makeRound(rnd, g.round); g.pick = -1; };
  next();
  g.press = (i, now) => {
    if (now < g.waitUntil || g.results.length >= 5) return null;
    const ok = i === g.round.answer; g.results.push(ok); g.pick = i; g.waitUntil = now + 1300; g.doneAt = now;
    g.msg = ok ? right : wrong(g.round);
    return { sfx: ok ? "right" : "wrong", anim: ok ? ["mgHop", {}] : null };
  };
  if (hitTest) g.tap = (x, y, now, L) => { const i = hitTest(g, x, y, L); return i >= 0 ? g.press(i, now) : null; };
  const settle = (now) => { if (g.pick >= 0 && now >= g.waitUntil && g.results.length < 5) next(); };
  g.status = (now) => {
    settle(now);
    const n = g.results.length, correct = g.results.filter(Boolean).length;
    const text = now < g.waitUntil && g.pick >= 0 ? g.msg : n >= 5 ? "다 했어요!" : n === 0 && now < start + 900 ? intro : `${n + 1}번째 · ${intro}`;
    return { text, dots: dots(5, g.results), done: n >= 5 && now >= g.waitUntil, win: correct >= 3, score: `${correct}번 맞혔어요`, enabled: now >= g.waitUntil && n < 5 };
  };
  g.objects = (now, L) => { settle(now); return objects(g, now, L); };
  g.pet = (now, L) => { settle(now); return pet ? pet(g, now, L) : { center: true }; };
  return g;
}
// 앞 판과 다른 것 고르기(반복문 없이: 무작위가 같은 값만 내도 멈추지 않게)
const other = (n, prev, r) => { if (prev == null || n < 2) return Math.floor(r() * n); const k = Math.floor(r() * (n - 1)); return k >= prev ? k + 1 : k; };
const shuffle = (arr, rnd) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// 좋아하는 간식: 생각 말풍선 속 간식을 버튼으로 고름
const SNACKS = [{ label: "사과", sprite: "apple" }, { label: "당근", sprite: "carrot" }, { label: "사탕", sprite: "candy" }];
function snackGame(start, rnd) {
  return pickRounds("snack", start, rnd, {
    labels: SNACKS.map((x) => x.label), intro: "무엇이 먹고 싶을까요?",
    makeRound: (r, prev) => ({ answer: r() < 0.3 ? Math.floor(r() * 3) : other(3, prev?.answer, r) }), // 가끔은 같은 간식이 또
    wrong: (rd) => `${SNACKS[rd.answer].label}${rd.answer === 1 ? "이" : "가"} 먹고 싶었대요`,
    objects: (g, now, L) => {
      const bx = L.cx + 26, by = L.headY - 6, out = [{ sprite: "thinkBubble", x: bx, y: by, scale: 2 }];
      out.push({ sprite: SNACKS[g.round.answer].sprite, x: bx - 1, y: by - 6, scale: 2 });
      if (g.pick >= 0 && g.pick === g.round.answer && now < g.waitUntil) out.push({ sprite: "heart", x: L.cx, y: L.headY - 12 - ((now - g.doneAt) / 40), scale: 2, alpha: 1 - (now - g.doneAt) / 1300 });
      return out;
    },
    pet: (g, now) => (g.pick >= 0 && now < g.waitUntil ? { center: true, eyes: g.pick === g.round.answer ? "happy" : "closed", mouth: g.pick === g.round.answer ? "open" : "flat" } : { center: true, mouth: "o" }),
  });
}

// 표정 맞히기: 친구가 짓는 표정을 보고 버튼으로
const FACES = [{ label: "기뻐요", eyes: "happy", mouth: "bigsmile" }, { label: "슬퍼요", eyes: null, mouth: "wavy", tears: true }, { label: "졸려요", eyes: "sleep", mouth: "o" }, { label: "놀랐어요", eyes: "sparkle", mouth: "o" }];
function faceGame(start, rnd) {
  return pickRounds("face", start, rnd, {
    labels: FACES.map((x) => x.label), intro: "지금 어떤 기분일까요?",
    makeRound: (r, prev) => ({ answer: other(FACES.length, prev?.answer, r) }),
    right: "맞아요, 그 기분이에요!", wrong: (rd) => `${FACES[rd.answer].label} 표정이었어요`,
    objects: () => [],
    pet: (g, now) => {
      if (g.pick >= 0 && now < g.waitUntil) return { center: true, eyes: "happy", mouth: "smile" };
      const f = FACES[g.round.answer]; return { center: true, eyes: f.eyes, mouth: f.mouth, tears: !!f.tears };
    },
  });
}

// 다른 걸 찾아요: 별 4개 중 하나만 색이 달라요(캔버스 탭)
const STARS = ["starYellow", "starPink", "starBlue"];
const oddX = (i, L) => L.cx + (i - 1.5) * L.w * 0.2;
function oddGame(start, rnd) {
  return pickRounds("odd", start, rnd, {
    intro: "하나만 다른 별을 톡!",
    makeRound: (r) => { const [same, diff] = shuffle(STARS, r); return { answer: Math.floor(r() * 4), same, diff }; },
    wrong: () => "앗, 다른 별을 다시 찾아봐요",
    hitTest: (g, x, y, L) => { for (let i = 0; i < 4; i++) if (Math.abs(x - oddX(i, L)) <= 11 && y <= L.headY - 4 && y >= L.headY - 32) return i; return -1; },
    objects: (g, now, L) => {
      const out = [];
      for (let i = 0; i < 4; i++) {
        const bob = Math.round(Math.sin(now / 300 + i) * 1.5), hit = g.pick === i && now < g.waitUntil;
        out.push({ sprite: i === g.round.answer ? g.round.diff : g.round.same, x: oddX(i, L), y: L.headY - 8 + bob - (hit ? 4 : 0), scale: 2 });
        if (hit && i === g.round.answer) out.push({ sprite: "sparkle", x: oddX(i, L), y: L.headY - 26, scale: 2 });
      }
      return out;
    },
  });
}

// 제자리 찾아 주기: 물건을 장난감 통(왼쪽)이나 책장(오른쪽)으로
const TIDY = [{ sprite: "ball", to: 0 }, { sprite: "duck", to: 0 }, { sprite: "book", to: 1 }, { sprite: "letter", to: 1 }];
function tidyGame(start, rnd) {
  return pickRounds("tidy", start, rnd, {
    labels: ["◀ 장난감 통", "책장 ▶"], intro: "어디에 넣을까요?",
    makeRound: (r, prev) => { const t = other(TIDY.length, prev?.t, r); return { t, answer: TIDY[t].to }; },
    right: "깔끔해요!", wrong: (rd) => `${rd.answer === 0 ? "장난감 통" : "책장"}에 넣는 거였어요`,
    hitTest: (g, x, y, L) => (y > L.baseY - 34 && y <= L.baseY + 4 ? (x < L.cx - L.w * 0.22 ? 0 : x > L.cx + L.w * 0.22 ? 1 : -1) : -1),
    objects: (g, now, L) => {
      const lx = L.cx - L.w * 0.34, rx = L.cx + L.w * 0.34, out = [{ sprite: "toybox", x: lx, y: L.baseY + 2, scale: 2 }, { sprite: "bookshelf", x: rx, y: L.baseY + 2, scale: 2 }];
      const it = TIDY[g.round.t];
      if (g.pick >= 0 && now < g.waitUntil) { // 고른 쪽으로 쏙 날아감
        const k = clamp01((now - g.doneAt) / 450), tx = g.pick === 0 ? lx : rx;
        out.push({ sprite: it.sprite, x: L.cx + (tx - L.cx) * k, y: L.headY - 14 + (L.baseY - 14 - (L.headY - 14)) * k - Math.sin(k * Math.PI) * 14, scale: 2, alpha: 1 - Math.max(0, k - 0.85) * 6 });
      } else out.push({ sprite: it.sprite, x: L.cx, y: L.headY - 14 + Math.round(Math.sin(now / 250) * 1.5), scale: 2 });
      return out;
    },
  });
}

// 몇 개일까요?: 별 2~5개를 세어 숫자 버튼
function countGame(start, rnd) {
  return pickRounds("count", start, rnd, {
    labels: ["2", "3", "4", "5"], intro: "별이 몇 개일까요?",
    makeRound: (r, prev) => { const a = other(4, prev?.answer, r), n = a + 2; const spots = shuffle([0, 1, 2, 3, 4, 5, 6, 7], r).slice(0, n); return { answer: a, spots, color: STARS[Math.floor(r() * 3)] }; },
    wrong: (rd) => `${rd.answer + 2}개였어요`,
    objects: (g, now, L) => g.round.spots.map((s, i) => ({ sprite: g.round.color, x: L.cx + ((s % 4) - 1.5) * L.w * 0.18, y: L.headY - 8 - Math.floor(s / 4) * 20 + Math.round(Math.sin(now / 320 + i) * 1.5), scale: 2 })),
    pet: () => ({ center: true, eyes: null, mouth: "o" }),
  });
}
