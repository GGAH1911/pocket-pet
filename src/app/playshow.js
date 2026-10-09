// 같이 놀기 장면(2026-10-09 사용자: "기분만 올라가고 서로 노는 장면이 안 나와. 놀이방 장난감으로 서로 노는 장면, 산책처럼").
// 놓인 놀이 기구마다 한 막(약 5초), 기구가 없으면 술래잡기. 마지막은 다 같이 콩콩 + 하트.
// 주인공 둘(내 친구 + 손님 하나)이 기구를 쓰고, 나머지는 옆에서 응원 콩콩. 순수 계산(그리기 없음) → 시험 가능.
// 좌표: 놀이방 256×200, 바닥 FLOOR=96. 기구는 2배(K)로 그림 — 1배면 어른 친구가 그네·미끄럼틀보다 커서 탈 수 없어 보였음(첫 시험 캡처).
// 기구 자리(playroom.js와 같음): 왼쪽 (52, 132), 가운데 (128, 126), 오른쪽 (204, 132)
export const K = 2, PW = 256, PH = 200;
export const SPOT = { playL: { x: 52, base: 132 }, playM: { x: 128, base: 126 }, playR: { x: 204, base: 132 } };
export const ACT_MS = 5200, FINALE_MS = 2600, INTRO_MS = 900;
const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
const seg = (u, a, b) => Math.max(0, Math.min(1, (u - a) / (b - a)));
const hop = (k, h) => -Math.sin(Math.PI * Math.max(0, Math.min(1, k))) * h; // 포물선 점프(위로 음수)
const ACT_OF = { play_slide: "slide", play_tent: "tent", play_pool: "pool", play_blocks: "blocks", play_tramp: "tramp", play_swing: "swing" };
export const ACT_KO = { slide: "미끄럼틀 타기", tent: "텐트 숨바꼭질", pool: "볼풀 풍덩", blocks: "블록 쌓기", tramp: "트램펄린 통통", swing: "그네 밀어 주기", tag: "술래잡기", finale: "다 같이 콩콩" };

// 장면 순서: 놓인 기구(왼→가운데→오른) 한 막씩, 없으면 술래잡기. 다시 볼 때는 시작 막을 돌려 순서가 바뀜
export function planShow(equipped = {}, round = 0) {
  const acts = ["playL", "playM", "playR"].filter((s) => ACT_OF[equipped[s]]).map((s) => ({ kind: ACT_OF[equipped[s]], slot: s }));
  if (!acts.length) acts.push({ kind: "tag", slot: null });
  const r = round % acts.length;
  const order = [...acts.slice(r), ...acts.slice(0, r)];
  let at = INTRO_MS;
  const timeline = order.map((a) => { const x = { ...a, at, ms: ACT_MS }; at += ACT_MS; return x; });
  timeline.push({ kind: "finale", slot: null, at, ms: FINALE_MS });
  return { acts: timeline, total: at + FINALE_MS };
}

// 친구들 제자리(앞줄)
export const homeOf = (i, n) => ({ x: Math.round(((i + 0.5) / n) * PW), base: 190 - (i % 2) * 6 });

// 지금 막과 그 안의 진행(u 0~1)
export function actAt(show, ms) {
  for (const a of show.acts) if (ms >= a.at && ms < a.at + a.ms) return { act: a, u: (ms - a.at) / a.ms };
  return { act: null, u: 0 };
}

// 한 친구의 자세. i = 친구 번호(0 = 내 친구), n = 친구 수, ms = 장면 시작 뒤 시간
// 돌려줌: { x, base, flip, clip(이 y 아래는 안 보임), hidden, cheer }
export function poseAt(show, i, n, ms) {
  const home = homeOf(i, n);
  const idle = { x: home.x, base: home.base + hop((ms % 700) / 700, ms < INTRO_MS ? 0 : 0), flip: false };
  const { act, u } = actAt(show, ms);
  if (!act) return idle;
  if (act.kind === "finale") return { x: home.x, base: home.base + hop(((ms - act.at) % 520) / 520, 14), flip: (i % 2) === 1, cheer: true, heart: ((ms - act.at) % 1040) < 40 };
  const role = i === 0 ? 0 : i === 1 ? 1 : -1; // 주인공 둘
  if (role < 0) return { x: home.x, base: home.base + hop(((ms + i * 170) % 900) / 900, 6), flip: home.x > PW / 2, cheer: true }; // 응원 콩콩(가운데를 봄)
  const sp = SPOT[act.slot] || { x: 128, base: 160 };
  const mine = role === 0 ? seg(u, 0, 0.5) : seg(u, 0.5, 1); // 둘이 번갈아(앞 반·뒤 반)
  const waiting = role === 0 ? u >= 0.5 : u < 0.5;
  const wx = act.kind === "slide" ? sp.x + 58 + role * 18 : sp.x + (role === 0 ? -34 : 34); // 미끄럼틀은 내려오는 쪽에서 기다림
  const wait = { x: Math.max(22, Math.min(PW - 22, wx)), base: sp.base + 40 + hop(((ms + role * 300) % 800) / 800, 2), flip: role === 1 }; // 차례 기다리며 옆에서 콩콩
  switch (act.kind) {
    case "slide": { // 사다리 오르기 → 꼭대기 → 미끄러져 내려오기
      if (waiting) return wait;
      const k = mine;
      if (k < 0.15) return { x: lerp(home.x, sp.x - 11 * K, k / 0.15), base: lerp(home.base, sp.base, k / 0.15) + hop(k / 0.15, 10) };
      if (k < 0.45) return { x: sp.x - 11 * K, base: lerp(sp.base, sp.base - 33 * K, seg(k, 0.15, 0.45)) + (Math.floor(ms / 140) % 2) * 2 };
      if (k < 0.55) return { x: lerp(sp.x - 11 * K, sp.x - 2 * K, seg(k, 0.45, 0.55)), base: sp.base - 31 * K };
      if (k < 0.82) { const s = seg(k, 0.55, 0.82) ** 1.6; return { x: lerp(sp.x - 2 * K, sp.x + 20 * K, s), base: lerp(sp.base - 31 * K, sp.base - 3 * K, s), whee: true }; }
      return { x: lerp(sp.x + 22 * K, home.x, seg(k, 0.82, 1)), base: lerp(sp.base, home.base, seg(k, 0.82, 1)) + hop(seg(k, 0.82, 1), 10) };
    }
    case "pool": { // 둘이 차례로 풍덩 → 머리만 보이며 흔들 → 같이 나옴
      const jin = role === 0 ? seg(u, 0.05, 0.25) : seg(u, 0.25, 0.45), out = seg(u, 0.8, 1);
      const px = sp.x + (role === 0 ? -8 : 8) * K;
      if (out > 0) return { x: lerp(px, home.x, out), base: lerp(sp.base - 4 * K, home.base, out) + hop(out, 24), heart: out < 0.1 };
      if (jin < 1) return { x: lerp(home.x, px, jin), base: lerp(home.base, sp.base - 4 * K, jin) + hop(jin, 40), clip: jin > 0.7 ? sp.base - 12 * K : null, splash: jin > 0.9 };
      return { x: px + Math.round(Math.sin(ms / 160 + role) * 3), base: sp.base - 4 * K + Math.round(Math.sin(ms / 220 + role * 2) * 2), clip: sp.base - 12 * K, flip: role === 1, splash: (Math.floor(ms / 400) + role) % 3 === 0 };
    }
    case "blocks": { // 양쪽에서 번갈아 콩콩 → 블록 흔들 → 마주 보고 하트
      const side = role === 0 ? -1 : 1, x = sp.x + side * 24 * K;
      if (u < 0.15) return { x: lerp(home.x, x, u / 0.15), base: lerp(home.base, sp.base + 4, u / 0.15) + hop(u / 0.15, 10), flip: role === 1 };
      const beat = ((ms + role * 350) % 700) / 700;
      return { x, base: sp.base + 4 + hop(beat, 10), flip: role === 1, heart: u > 0.75 && beat < 0.05 };
    }
    case "tent": { // 둘이 텐트로 쏙 → 숨음 → 짠 하고 튀어나옴
      if (u < 0.25) { const k = seg(u, role === 0 ? 0 : 0.08, role === 0 ? 0.18 : 0.25); return { x: lerp(home.x, sp.x, k), base: lerp(home.base, sp.base, k) + hop(k, 10), hidden: k >= 1 }; }
      if (u < 0.6) return { x: sp.x, base: sp.base, hidden: true, peek: Math.floor(ms / 500) % 3 === role };
      const k = seg(u, 0.6, 0.85), side = role === 0 ? -1 : 1;
      if (k < 1) return { x: lerp(sp.x, sp.x + side * 20 * K, k), base: sp.base + 10 + hop(k, 30), flip: role === 0, heart: k < 0.1 };
      const back = seg(u, 0.85, 1); return { x: lerp(sp.x + side * 20 * K, home.x, back), base: lerp(sp.base + 10, home.base, back) + hop(back, 8) };
    }
    case "swing": { // 하나는 그네, 하나는 뒤에서 밀어 주기 → 바꿈
      const riding = role === 0 ? u < 0.5 : u >= 0.5;
      const sw = swingOf(act, u, ms);
      if (riding) return { x: sp.x + sw * K, base: sp.base - 11 * K, ride: true, whee: Math.abs(sw) > 4 };
      const push = Math.max(0, -Math.sin((ms / 1300) * Math.PI * 2)); // 그네가 뒤로 올 때 밀기
      return { x: sp.x - 22 * K + Math.round(push * 6), base: sp.base + 4, flip: false };
    }
    case "tramp": { // 번갈아 높이 통통
      if (waiting) return wait;
      const k = mine, b = (k * 4) % 1; // 네 번 뛰기
      if (k < 0.1) return { x: lerp(home.x, sp.x, k / 0.1), base: lerp(home.base, sp.base - 9 * K, k / 0.1) + hop(k / 0.1, 16) };
      if (k > 0.9) return { x: lerp(sp.x, home.x, seg(k, 0.9, 1)), base: lerp(sp.base - 9 * K, home.base, seg(k, 0.9, 1)) + hop(seg(k, 0.9, 1), 12) };
      return { x: sp.x, base: sp.base - 9 * K + hop(b, 50), whee: b > 0.3 && b < 0.7 };
    }
    case "tag": default: { // 술래잡기: 내 친구가 도망, 손님이 쫓아감, 마지막엔 잡혀서 하트
      const ang = (ms - act.at) / 900 + (role === 1 ? -0.9 : 0), cx = 128, cy = 160;
      if (u > 0.85) { const k = seg(u, 0.85, 1); return { x: lerp(cx + Math.cos(ang) * 80, cx + (role === 0 ? -14 : 14), k), base: cy + Math.sin(ang) * 14 * (1 - k), flip: role === 0, heart: k > 0.5 && k < 0.6 }; }
      return { x: cx + Math.cos(ang) * 80, base: cy + Math.sin(ang) * 14 + hop(((ms + role * 120) % 300) / 300, 4), flip: -Math.sin(ang) < 0 };
    }
  }
}

// 기구 움직임(장면에 맞춤)
export function swingOf(act, u, ms) { return act?.kind === "swing" ? Math.round(Math.sin((ms / 1300) * Math.PI * 2) * 6) : null; } // 기구 1배 기준 도트(그릴 때 K배)
export function toyOpts(show, slot, ms) {
  const { act, u } = actAt(show, ms);
  if (!act || act.slot !== slot) return {};
  if (act.kind === "swing") return { sw: swingOf(act, u, ms) };
  if (act.kind === "tramp") { const role0 = u < 0.5, k = role0 ? u / 0.5 : (u - 0.5) / 0.5, b = (k * 4) % 1; return { dip: k > 0.1 && k < 0.9 && (b < 0.12 || b > 0.88) ? 3 : 0 }; }
  if (act.kind === "blocks") return { shake: u > 0.15 && u < 0.75 ? 1 : 0 };
  return {};
}
