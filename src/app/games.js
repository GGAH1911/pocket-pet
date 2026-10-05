// 놀이(미니게임) 4종. 화면·DOM과 분리된 순수 로직: 시각(ms)과 입력만 받아 상태를 바꾸고,
// 그릴 물체·펫 자세·안내 문구를 돌려준다. main.js가 이어 붙이고, 결과(승/패)는 sim.play로 넘긴다.
// L(배치): { w, h, cx, baseY, headY } — 캔버스 논리 좌표. 물체 x는 가운데, y는 바닥 기준.

export const GAMES = ["side", "bubbles", "hide", "catch"];
export const GAME_NAMES = { side: "어느 쪽?", bubbles: "비눗방울 톡톡", hide: "숨바꼭질", catch: "공 받기" };

// 바로 앞 놀이는 연달아 안 나오게 무작위로 고른다
export function pickGame(last, rnd = Math.random) {
  const pool = GAMES.filter((g) => g !== last);
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
}

export function createGame(kind, now, rnd = Math.random) {
  const make = { side: sideGame, bubbles: bubbleGame, hide: hideGame, catch: catchGame }[kind];
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
