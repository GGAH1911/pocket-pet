// 산책 코스(2026-10-08 사용자 요청: 공원 말고 해변·산 등). 코스마다 배경 층과 길에서 만나는 것이 다르다.
// 배경: 하늘(실제 시각·날씨, screen.js) 아래에 먼 층(느리게)·땅·길·가까운 층(빠르게)이 흘러간다. d = 걸어간 거리(px).
// 만나는 것의 반응은 anim.js WALK_REACT로 공원 것(나비·꽃·웅덩이·친구)에 맞춘다.
import { PALETTE as P } from "./palette.js?v=9326bfc-1791552396";

export const COURSES = {
  park: { name: "공원", kinds: ["butterfly", "flower", "puddle", "friend"], splash: "puddle" },
  beach: { name: "바닷가", kinds: ["crab", "shell", "wave", "friend"], splash: "wave" },
  mountain: { name: "산길", kinds: ["squirrel", "mushroom", "stream", "friend"], splash: "stream" },
  lake: { name: "숲속 호수", kinds: ["duck", "clover", "frog", "friend"], splash: "puddle" },
};
// 만난 것 → 반응 종류(올려다보고 콩 / 킁킁 하트 / 첨벙 / 인사)
export const WALK_REACT = { butterfly: "butterfly", crab: "butterfly", squirrel: "butterfly", duck: "butterfly", frog: "butterfly", flower: "flower", shell: "flower", mushroom: "flower", clover: "flower", puddle: "puddle", wave: "puddle", stream: "puddle", friend: "friend" };
export const WALK_KO = {
  butterfly: "나비를 만났어요", flower: "꽃 냄새를 맡았어요", puddle: "웅덩이에서 첨벙했어요", friend: "친구를 만났어요",
  crab: "꽃게를 만났어요", shell: "조개껍데기를 찾았어요", wave: "파도에 발을 담갔어요",
  squirrel: "다람쥐를 만났어요", mushroom: "버섯 냄새를 맡았어요", stream: "개울에서 첨벙했어요",
  duck: "아기 오리를 만났어요", clover: "네잎클로버를 찾았어요", frog: "개구리를 만났어요",
};
export const isSplash = (kind) => WALK_REACT[kind] === "puddle";

const hashN = (n) => { const x = Math.sin(n * 91.7) * 43758.5453; return x - Math.floor(x); };
const R = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
// 동그라미(테두리 포함) 칠하기
function blob(ctx, cx, cy, r, fill, edge = P.k) {
  for (let yy = -r - 1; yy <= r + 1; yy++) { const hw = Math.round(Math.sqrt(Math.max(0, (r + 1) * (r + 1) - yy * yy))); R(ctx, cx - hw, cy + yy, hw * 2 + 1, 1, edge); }
  for (let yy = -r; yy <= r; yy++) { const hw = Math.round(Math.sqrt(r * r - yy * yy)); R(ctx, cx - hw, cy + yy, hw * 2 + 1, 1, fill); }
}
// 반복되는 물건을 세계 위치에 고정해 흘려보낸다(같은 자리 = 같은 모양)
function scroll(w, d, speed, span, fn) {
  for (let i = -2; i < Math.ceil(w / span) + 3; i++) { const wi = Math.floor((d * speed) / span) + i; fn(Math.round(wi * span - d * speed), wi); }
}

// 배경 그리기. 돌려줌: { pathTop, pathH } (펫·물건이 서는 길)
export function drawCourseBg(ctx, course, { w, h, d, now, groundY, winter = false }) {
  const pathTop = groundY + Math.round((h - groundY) * 0.28), pathH = 24;
  if (course === "beach") {
    // 먼 바다 + 돛단배
    const seaB = groundY + Math.round((pathTop - groundY) * 0.7);
    R(ctx, 0, groundY - 6, w, seaB - groundY + 6, "#5aa7e6"); R(ctx, 0, groundY - 6, w, 2, "#8ecbff");
    for (let i = 0; i < 18; i++) { const x = (hashN(i) * w * 1.4 - d * 0.25 + now / 90 * (hashN(i + 5) - 0.5)) % w; R(ctx, (x + w) % w, groundY - 2 + Math.round(hashN(i + 9) * (seaB - groundY)), 3 + Math.round(hashN(i + 2) * 4), 1, "#d6ecff"); }
    scroll(w, d, 0.12, 170, (x, wi) => { if (hashN(wi) < 0.5) return; const bx = x + 40, by = groundY - 4; R(ctx, bx, by, 12, 3, P.k); R(ctx, bx + 1, by, 10, 2, P.w); R(ctx, bx + 5, by - 10, 1, 10, P.k); R(ctx, bx + 6, by - 9, 4, 8, P.w); R(ctx, bx + 6, by - 9, 1, 8, P.k); });
    // 모래사장 + 파도 거품(시간에 따라 들락날락)
    R(ctx, 0, seaB, w, h - seaB, "#f3dfae");
    const tide = Math.sin(now / 1400) * 2;
    for (let x = 0; x < w; x += 2) { const y = seaB + Math.round(Math.sin((x + d) / 9 + now / 400) * 1.5 + tide); R(ctx, x, seaB, 2, Math.max(0, y - seaB + 2), "#e6c98f"); R(ctx, x, y, 2, 2, P.w); }
    for (let y = seaB + 8; y < h; y += 7) for (let x = -((d * 1.0) % 14); x < w; x += 14) R(ctx, x + (y % 3) * 4, y, 1, 1, "#d9b97c");
    // 파라솔(가끔)
    scroll(w, d, 0.8, 150, (x, wi) => { if (hashN(wi + 3) < 0.55) return; const px = x + 30, py = seaB + 4; R(ctx, px, py - 14, 1, 16, P.N); for (let yy = 0; yy < 5; yy++) { const hw = 3 + yy * 2; for (let xx = -hw; xx <= hw; xx++) R(ctx, px + xx, py - 19 + yy, 1, 1, yy === 0 || Math.abs(xx) === hw ? P.k : Math.floor((xx + 20) / 3) % 2 ? P.r : P.w); } });
    // 걷는 길: 단단한 젖은 모래 + 발자국
    R(ctx, 0, pathTop, w, pathH, "#ead2a0"); R(ctx, 0, pathTop, w, 1, "#dcbd84"); R(ctx, 0, pathTop + pathH - 1, w, 1, "#dcbd84");
    scroll(w, d, 1, 10, (x, wi) => { R(ctx, x, pathTop + 9 + (wi % 2) * 5, 2, 2, "#d6b47a"); });
    // 가까운 층: 불가사리·조개·풀
    scroll(w, d, 1.3, 30, (x, wi) => {
      const y = pathTop + pathH + 9 + Math.round(hashN(wi + 2) * 12), t = hashN(wi + 5);
      if (t < 0.3) { R(ctx, x, y - 3, 1, 3, P.G); R(ctx, x + 2, y - 5, 1, 5, P.G); R(ctx, x + 4, y - 3, 1, 3, P.G); }
      else if (t < 0.55) { R(ctx, x + 1, y - 4, 1, 5, P.O); R(ctx, x - 1, y - 2, 5, 1, P.O); R(ctx, x, y, 1, 1, P.O); R(ctx, x + 2, y, 1, 1, P.O); }
      else if (t < 0.75) { R(ctx, x, y - 3, 5, 3, P.k); R(ctx, x + 1, y - 3, 3, 2, P.p); R(ctx, x + 2, y - 3, 1, 2, P.w); }
    });
    return { pathTop, pathH };
  }
  if (course === "mountain") {
    // 먼 산(아주 느리게) + 눈 덮인 봉우리
    scroll(w, d, 0.1, 80, (x, wi) => {
      const ph = 26 + Math.round(hashN(wi) * 22), base = groundY + 2, cx = x + 40, hw = 34 + Math.round(hashN(wi + 1) * 14);
      for (let yy = 0; yy < ph; yy++) { const half = Math.round((yy / ph) * hw); R(ctx, cx - half, base - ph + yy, half * 2 + 1, 1, yy < 5 + Math.round(hashN(wi + 2) * 4) ? "#f4f7ff" : yy < ph * 0.55 ? "#9fb3c9" : "#8aa0b9"); }
    });
    // 소나무(중간 층)
    const ground = winter ? "#f4f7ff" : "#7cc489";
    R(ctx, 0, groundY, w, h - groundY, ground);
    scroll(w, d, 0.55, 30, (x, wi) => {
      if (hashN(wi + 4) < 0.25) return;
      const tx = x + Math.round(hashN(wi) * 10), th = 18 + Math.round(hashN(wi + 7) * 10), by = groundY + 4;
      R(ctx, tx, by - 4, 2, 5, P.N);
      for (let yy = 0; yy < th; yy++) { const half = Math.round(((yy % 7) + yy * 0.6) / 2.4) + 1; R(ctx, tx + 1 - half - 1, by - 4 - th + yy, half * 2 + 2, 1, P.k); R(ctx, tx + 1 - half, by - 4 - th + yy, half * 2, 1, winter && yy % 7 < 2 ? "#f4f7ff" : "#2f8a5e"); }
    });
    if (!winter) for (let y = groundY + 6; y < h; y += 9) for (let x = -((d * 1.2) % 16); x < w; x += 16) R(ctx, x + (y % 3) * 5, y, 2, 1, P.G);
    else for (let y = groundY + 6; y < h; y += 9) for (let x = -((d * 1.2) % 16); x < w; x += 16) R(ctx, x + (y % 3) * 5, y, 2, 1, "#dfe6f2");
    // 흙길 + 돌
    R(ctx, 0, pathTop, w, pathH, winter ? "#e7ddd3" : "#cfa77a"); R(ctx, 0, pathTop, w, 2, winter ? "#d8ccc0" : "#b98c5c"); R(ctx, 0, pathTop + pathH - 2, w, 2, winter ? "#d8ccc0" : "#b98c5c");
    scroll(w, d, 1, 22, (x, wi) => { const sx = x + Math.round(hashN(wi) * 12), sy = pathTop + 5 + Math.round(hashN(wi + 1) * 13); R(ctx, sx, sy, 4, 2, P.L); R(ctx, sx, sy + 2, 4, 1, "#8b94a8"); });
    // 가까운 층: 바위·고산 꽃
    scroll(w, d, 1.3, 28, (x, wi) => {
      const y = pathTop + pathH + 9 + Math.round(hashN(wi + 2) * 12), t = hashN(wi + 5);
      if (t < 0.3) { R(ctx, x, y - 6, 9, 6, P.k); R(ctx, x + 1, y - 5, 7, 5, P.L); R(ctx, x + 2, y - 5, 3, 1, P.W); if (winter) R(ctx, x + 1, y - 6, 7, 2, "#f4f7ff"); }
      else if (t < 0.6 && !winter) { R(ctx, x, y - 3, 1, 3, P.G); R(ctx, x - 1, y - 5, 3, 2, [P.v, P.y, P.w][Math.floor(hashN(wi + 6) * 3)]); }
    });
    return { pathTop, pathH };
  }
  if (course === "lake") {
    // 먼 숲
    R(ctx, 0, groundY - 2, w, h - groundY + 2, P.g);
    scroll(w, d, 0.3, 18, (x, wi) => { const r = 7 + Math.round(hashN(wi) * 4); blob(ctx, x + 9, groundY - 4 - Math.round(hashN(wi + 1) * 5), r, "#3f8f63", "#2b6a49"); });
    // 호수: 물빛·윤슬·연잎
    const lakeT = groundY + 3, lakeB = groundY + Math.round((pathTop - groundY) * 0.85);
    R(ctx, 0, lakeT, w, lakeB - lakeT, "#6fb6e8"); R(ctx, 0, lakeT, w, 1, "#4f93cf");
    for (let i = 0; i < 14; i++) { const x = (hashN(i) * w * 1.3 - d * 0.5 + Math.sin(now / 700 + i) * 2) % w; R(ctx, (x + w) % w, lakeT + 2 + Math.round(hashN(i + 9) * (lakeB - lakeT - 4)), 4, 1, "#d6ecff"); }
    scroll(w, d, 0.5, 40, (x, wi) => { if (hashN(wi + 2) < 0.4) return; const lx = x + 12, ly = lakeT + 3 + Math.round(hashN(wi) * (lakeB - lakeT - 6)); R(ctx, lx, ly, 7, 2, P.G); R(ctx, lx + 1, ly - 1, 5, 1, P.g); if (hashN(wi + 8) > 0.6) R(ctx, lx + 3, ly - 2, 2, 2, P.p); });
    // 나무 데크 길(판자)
    R(ctx, 0, pathTop, w, pathH, "#d9a574"); R(ctx, 0, pathTop, w, 2, P.N); R(ctx, 0, pathTop + pathH - 2, w, 2, P.N);
    scroll(w, d, 1, 8, (x) => R(ctx, x, pathTop + 2, 1, pathH - 4, "#b37c4f"));
    scroll(w, d, 1, 48, (x) => { R(ctx, x + 4, pathTop + pathH - 2, 3, 6, P.N); });
    // 가까운 층: 갈대·부들
    scroll(w, d, 1.3, 14, (x, wi) => {
      const y = pathTop + pathH + 12 + Math.round(hashN(wi + 2) * 10), hgt = 8 + Math.round(hashN(wi + 3) * 8);
      if (hashN(wi + 5) < 0.35) return;
      R(ctx, x, y - hgt, 1, hgt, P.G); R(ctx, x + 2, y - hgt + 3, 1, hgt - 3, P.G);
      if (hashN(wi + 6) > 0.55) { R(ctx, x - 1, y - hgt - 4, 3, 5, P.k); R(ctx, x, y - hgt - 3, 1, 3, P.N); }
    });
    return { pathTop, pathH };
  }
  // 공원(원래 장면)
  const span = 44;
  for (let i = -1; i < Math.ceil(w / span) + 2; i++) {
    const wi = Math.floor(d * 0.45 / span) + i;
    const tx = Math.round(wi * span - d * 0.45 + hashN(wi) * 14);
    const th = 14 + Math.round(hashN(wi + 7) * 8), r = 8 + Math.round(hashN(wi + 3) * 4);
    ctx.fillStyle = P.n; ctx.fillRect(tx - 1, groundY - th + r, 3, th - r + 2);
    for (const [cc, rr, oy] of [[P.k, r + 1, 0], [P.G, r, 0], [P.g, r - 3, -2]]) for (let yy = -rr; yy <= rr; yy++) { const hw = Math.round(Math.sqrt(rr * rr - yy * yy)); ctx.fillStyle = cc; ctx.fillRect(tx - hw, groundY - th + yy + oy + 2, hw * 2 + 1, 1); }
  }
  ctx.fillStyle = P.g; ctx.fillRect(0, groundY, w, h - groundY);
  ctx.fillStyle = P.G; for (let y = groundY + 4; y < h; y += 9) for (let x = -((d * 1.2) % 16); x < w; x += 16) ctx.fillRect(Math.round(x + (y % 3) * 5), y, 2, 1);
  ctx.fillStyle = "#f0d6a8"; ctx.fillRect(0, pathTop, w, pathH);
  ctx.fillStyle = "#e2bf86"; ctx.fillRect(0, pathTop, w, 2); ctx.fillRect(0, pathTop + pathH - 2, w, 2);
  for (let i = -1; i < w / 20 + 2; i++) { const wi = Math.floor(d / 20) + i; const x = Math.round(wi * 20 - d); ctx.fillStyle = "#d9b47a"; ctx.fillRect(x + Math.round(hashN(wi) * 12), pathTop + 5 + Math.round(hashN(wi + 1) * 14), 2, 1); }
  for (let i = -1; i < w / 26 + 2; i++) {
    const wi = Math.floor(d * 1.3 / 26) + i; const x = Math.round(wi * 26 - d * 1.3 + hashN(wi + 9) * 10), y = pathTop + pathH + 10 + Math.round(hashN(wi + 2) * 12);
    ctx.fillStyle = P.G; ctx.fillRect(x, y - 3, 1, 3); ctx.fillRect(x + 2, y - 4, 1, 4); ctx.fillRect(x + 4, y - 2, 1, 2);
    if (hashN(wi + 5) > 0.55) { ctx.fillStyle = [P.p, P.y, P.w, P.v][Math.floor(hashN(wi + 6) * 4)]; ctx.fillRect(x + 1, y - 6, 3, 2); ctx.fillStyle = P.y; ctx.fillRect(x + 2, y - 6, 1, 1); }
  }
  return { pathTop, pathH };
}

// 코스에서 만나는 것(공원 것은 screen.js drawWalkThing). k: 0 다가옴 / 0~1 만나는 중 / 1 지나감. 그렸으면 true
export function drawCourseThing(ctx, ev, x, baseY, k, now) {
  const t = now / 1000, near = k > 0 && k < 1;
  switch (ev.kind) {
    case "crab": { // 옆걸음 꽃게, 만나면 집게를 번쩍
      const sx = x + Math.round(Math.sin(t * 4) * 3), up = near ? (Math.floor(now / 200) % 2) * 2 : 0;
      R(ctx, sx - 6, baseY - 7, 13, 6, P.k); R(ctx, sx - 5, baseY - 6, 11, 4, P.r); R(ctx, sx - 3, baseY - 9, 2, 3, P.k); R(ctx, sx + 2, baseY - 9, 2, 3, P.k);
      R(ctx, sx - 9, baseY - 8 - up, 3, 3, P.k); R(ctx, sx - 8, baseY - 7 - up, 1, 1, P.r); R(ctx, sx + 7, baseY - 8 - up, 3, 3, P.k); R(ctx, sx + 8, baseY - 7 - up, 1, 1, P.r);
      for (let i = 0; i < 3; i++) { R(ctx, sx - 6 + i * 2, baseY - 1, 1, 1, P.k); R(ctx, sx + 2 + i * 2, baseY - 1, 1, 1, P.k); }
      return true;
    }
    case "shell": R(ctx, x - 4, baseY - 6, 9, 6, P.k); R(ctx, x - 3, baseY - 5, 7, 4, P.p); R(ctx, x - 1, baseY - 5, 1, 4, P.w); R(ctx, x + 1, baseY - 5, 1, 4, P.w); R(ctx, x - 1, baseY - 1, 3, 1, P.k); return true;
    case "wave": { // 발밑으로 밀려오는 파도
      const reach = near ? Math.sin(Math.min(1, k * 1.6) * Math.PI) : 0.25;
      const len = Math.round(16 + reach * 18);
      R(ctx, x - len, baseY - 2, len * 2, 3, "#8ecbff"); R(ctx, x - len, baseY - 3, len * 2, 1, P.w);
      if (k > 0.5 && k < 0.85) { const s = (k - 0.5) / 0.35; for (let i = 0; i < 6; i++) { const ang = Math.PI * (0.15 + (i / 5) * 0.7); R(ctx, x + Math.cos(ang) * s * 18 * (i % 2 ? 1 : -1), baseY - Math.sin(ang) * s * 14 + s * s * 8, 2, 2, P.w); } }
      return true;
    }
    case "squirrel": { // 꼬리가 큰 다람쥐, 만나면 콩콩
      const hop = near ? Math.round(Math.abs(Math.sin(k * Math.PI * 4)) * 4) : 0, y = baseY - hop;
      R(ctx, x + 2, y - 15, 7, 11, P.k); R(ctx, x + 3, y - 14, 5, 9, P.O); R(ctx, x + 4, y - 13, 2, 7, P.o);
      R(ctx, x - 5, y - 10, 8, 9, P.k); R(ctx, x - 4, y - 9, 6, 7, P.n); R(ctx, x - 6, y - 12, 5, 5, P.k); R(ctx, x - 5, y - 11, 3, 3, P.n); R(ctx, x - 5, y - 13, 1, 2, P.k);
      R(ctx, x - 4, y - 10, 1, 1, P.k); if (near) R(ctx, x - 7, y - 8, 2, 2, P.N); // 도토리
      return true;
    }
    case "mushroom": R(ctx, x - 1, baseY - 6, 3, 6, P.k); R(ctx, x, baseY - 6, 1, 6, P.w); R(ctx, x - 6, baseY - 12, 13, 6, P.k); R(ctx, x - 5, baseY - 11, 11, 4, P.r); R(ctx, x - 3, baseY - 10, 2, 1, P.w); R(ctx, x + 2, baseY - 9, 2, 1, P.w); return true;
    case "stream": { // 길을 가로지르는 개울
      for (let yy = -6; yy <= 4; yy++) { const off = Math.round(Math.sin((yy + t * 6) / 2) * 2); R(ctx, x - 9 + off, baseY + yy, 18, 1, yy === -6 || yy === 4 ? "#4f93cf" : "#8ecbff"); }
      R(ctx, x - 4 + Math.round(Math.sin(t * 3) * 3), baseY - 2, 3, 1, P.w);
      if (k > 0.5 && k < 0.85) { const s = (k - 0.5) / 0.35; for (let i = 0; i < 6; i++) { const ang = Math.PI * (0.15 + (i / 5) * 0.7); R(ctx, x + Math.cos(ang) * s * 18 * (i % 2 ? 1 : -1), baseY - Math.sin(ang) * s * 14 + s * s * 8, 2, 2, P.b); } }
      return true;
    }
    case "duck": { // 아기 오리 뒤뚱뒤뚱
      const wob = Math.round(Math.sin(t * 6) * 1);
      R(ctx, x - 5, baseY - 9 + wob, 11, 8, P.k); R(ctx, x - 4, baseY - 8 + wob, 9, 6, P.y);
      R(ctx, x - 7, baseY - 14 + wob, 7, 7, P.k); R(ctx, x - 6, baseY - 13 + wob, 5, 5, P.y); R(ctx, x - 9, baseY - 11 + wob, 3, 2, P.o); R(ctx, x - 5, baseY - 12 + wob, 1, 1, P.k);
      R(ctx, x - 2, baseY - 1, 1, 1, P.o); R(ctx, x + 2, baseY - 1, 1, 1, P.o);
      if (near && k > 0.4) { R(ctx, x - 1, baseY - 22, 1, 1, P.k); }
      return true;
    }
    case "clover": R(ctx, x, baseY - 5, 1, 5, P.G); for (const [dx, dy] of [[-3, -9], [1, -9], [-3, -5], [1, -5]]) { R(ctx, x + dx - 1, baseY + dy - 1, 5, 5, P.k); R(ctx, x + dx, baseY + dy, 3, 3, P.G); } R(ctx, x - 1, baseY - 7, 3, 2, P.g); return true;
    case "frog": { // 연잎 위 개구리, 만나면 폴짝
      const hop = near ? Math.round(Math.sin(Math.min(1, k * 2) * Math.PI) * 8) : 0;
      R(ctx, x - 7, baseY - 2, 14, 2, P.G);
      R(ctx, x - 5, baseY - 9 - hop, 11, 7, P.k); R(ctx, x - 4, baseY - 8 - hop, 9, 5, P.g); R(ctx, x - 4, baseY - 11 - hop, 3, 3, P.k); R(ctx, x + 2, baseY - 11 - hop, 3, 3, P.k);
      R(ctx, x - 3, baseY - 10 - hop, 1, 1, P.w); R(ctx, x + 3, baseY - 10 - hop, 1, 1, P.w); R(ctx, x - 2, baseY - 6 - hop, 5, 1, P.G);
      return true;
    }
  }
  return false;
}

// 상점 미리 보기: 한낮 하늘 + 배경(펫 없이)
export function drawCourseThumb(canvas, course, { winter = false } = {}) {
  const ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false;
  const w = canvas.width, h = canvas.height, groundY = Math.round(h * 0.5);
  const g = ctx.createLinearGradient(0, 0, 0, groundY); g.addColorStop(0, "#8ecbff"); g.addColorStop(1, "#d6ecff");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, groundY);
  R(ctx, Math.round(w * 0.78), 8, 8, 8, P.y); // 해
  drawCourseBg(ctx, course, { w, h, d: 37, now: 1000, groundY, winter });
}
