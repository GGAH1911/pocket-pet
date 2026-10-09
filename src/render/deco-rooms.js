// 새 방 4개(꿈나라 침실·냠냠 부엌·보글 욕실·햇살 온실) 꾸미기 그림(2026-10-04).
// deco.js와 같은 규칙: 캔버스 논리 픽셀, 정수 좌표, 검정(k) 외곽선 1도트, 글씨 없음.
// 가구·바닥 소품은 x = 가운데, base = 바닥에 닿는 y. 벽걸이(hang_*)는 base = 가운데 y.
// 각 함수는 이 파일이 아는 id면 그리고 true, 모르면 아무것도 안 그리고 false.
import { PALETTE } from "./palette.js?v=8143ed3-1791554505";

const P = PALETTE;
const rect = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const ellipse = (ctx, cx, cy, rx, ry, c) => { for (let i = -ry; i <= ry; i++) { const hw = Math.round(Math.sqrt(Math.max(0, 1 - (i / ry) ** 2)) * rx); rect(ctx, cx - hw, cy + i, hw * 2, 1, c); } };
// 외곽선 상자: 테두리 k + 안쪽 색
const box = (ctx, x, y, w, h, c) => { rect(ctx, x, y, w, h, P.k); rect(ctx, x + 1, y + 1, w - 2, h - 2, c); };
// 모서리 한 칸 깎은 외곽선 상자
const rbox = (ctx, x, y, w, h, c) => { rect(ctx, x + 1, y, w - 2, h, P.k); rect(ctx, x, y + 1, w, h - 2, P.k); rect(ctx, x + 1, y + 1, w - 2, h - 2, c); };
// 모양 함수(inside)로 채우고 바깥 둘레에 외곽선(4방향 이웃)
function blob(ctx, x0, y0, w, h, inside, fill, out = P.k) {
  const isIn = (a, b) => a >= 0 && b >= 0 && a < w && b < h && inside(a, b);
  for (let yy = -1; yy <= h; yy++) for (let xx = -1; xx <= w; xx++) {
    if (isIn(xx, yy)) rect(ctx, x0 + xx, y0 + yy, 1, 1, typeof fill === "function" ? fill(xx, yy) : fill);
    else if (out && (isIn(xx - 1, yy) || isIn(xx + 1, yy) || isIn(xx, yy - 1) || isIn(xx, yy + 1))) rect(ctx, x0 + xx, y0 + yy, 1, 1, out);
  }
}
const inEll = (xx, yy, cx, cy, rx, ry) => ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1;
const star = (ctx, x, y, c, mid = c) => { rect(ctx, x - 1, y, 3, 1, c); rect(ctx, x, y - 1, 1, 3, c); rect(ctx, x, y, 1, 1, mid); };

// ---------- 벽지 ----------
export const ROOM_WALLS = { wall_bedroom: "#e6dcfb", wall_kitchen: "#fff4dc", wall_bath: "#d8efff", wall_garden: "#e6f6da" };
export function drawWallRoom(ctx, w, floorY, id) {
  const base = ROOM_WALLS[id];
  if (!base) return false;
  rect(ctx, 0, 0, w, floorY, base);
  if (id === "wall_bedroom") { // 연보라에 작은 별(큰 별은 연노랑, 작은 별은 진한 연보라)
    for (let n = 0, y = 6; y < floorY - 5; y += 11, n++) for (let m = 0, x = n % 2 ? 10 : 3; x < w; x += 14, m++) {
      if ((n + m) % 3 === 0) star(ctx, x, y, "#fff3b3", P.w);
      else { rect(ctx, x, y, 1, 1, "#c8b5f3"); if ((n + m) % 3 === 1) rect(ctx, x + 4, y + 4, 1, 1, "#d6c7f7"); }
    }
  } else if (id === "wall_kitchen") { // 크림·민트 세로줄
    for (let x = 0; x < w; x += 12) { rect(ctx, x, 0, 5, floorY, "#cdeedb"); rect(ctx, x + 5, 0, 1, floorY, "#e0f4e4"); }
    for (let n = 0, y = 5; y < floorY - 4; y += 8, n++) for (let x = 8 + (n % 2) * 0; x < w; x += 12) rect(ctx, x + 1, y, 1, 1, "#f5dcae"); // 크림 줄 위 작은 점
  } else if (id === "wall_bath") { // 하늘색 작은 타일
    for (let y = 0; y < floorY; y += 8) rect(ctx, 0, y, w, 1, "#bcdcf4");
    for (let n = 0, y = 0; y < floorY; y += 8, n++) for (let x = n % 2 ? 4 : 0; x < w; x += 8) { rect(ctx, x, y, 1, 8, "#bcdcf4"); rect(ctx, x + 1, y + 1, 2, 1, "#f0f9ff"); }
  } else if (id === "wall_garden") { // 온실 유리 격자 + 연두 덩굴
    for (let y = 0; y < floorY; y++) for (let x = (y * 3) % 23; x < w; x += 23) if (y % 14 > 2 && y % 14 < 6) rect(ctx, x, y, 1, 1, "#f6fdf0"); // 유리 반사(사선)
    for (let x = 0; x < w; x += 16) rect(ctx, x, 0, 2, floorY, "#fbfff6");
    for (let y = 0; y < floorY; y += 14) rect(ctx, 0, y, w, 2, "#fbfff6");
    for (let x = 0; x < w; x += 16) rect(ctx, x + 2, 0, 1, floorY, "#cfe9c0");
    for (let y = 0; y < floorY; y += 14) rect(ctx, 0, y + 2, w, 1, "#cfe9c0");
    for (let n = 0, y = 14; y < floorY; y += 14, n++) for (let x = n % 2 ? 16 : 0; x < w; x += 32) { // 격자 교차점의 연두 잎
      rect(ctx, x + 3, y - 2, 3, 2, "#a6dc93"); rect(ctx, x + 4, y - 3, 2, 1, "#a6dc93"); rect(ctx, x - 3, y + 2, 3, 2, "#a6dc93"); rect(ctx, x - 3, y + 4, 1, 1, P.G); rect(ctx, x + 5, y - 1, 1, 1, P.G);
    }
  }
  return true;
}

// ---------- 바닥 ----------
export function drawFloorRoom(ctx, w, h, floorY, id) {
  if (id === "floor_bedroom") { // 연보라 카펫(복슬 무늬)
    rect(ctx, 0, floorY, w, h - floorY, "#d3c1f4");
    for (let n = 0, y = floorY + 3; y < h; y += 5, n++) for (let x = n % 2 ? 1 : 4; x < w; x += 6) { rect(ctx, x, y, 2, 1, "#c0a8ee"); rect(ctx, x, y - 1, 1, 1, "#e2d6fa"); }
  } else if (id === "floor_kitchen") { // 노랑·흰 체크
    for (let y = floorY; y < h; y += 8) for (let x = 0; x < w; x += 8) rect(ctx, x, y, 8, 8, (Math.floor(x / 8) + Math.floor((y - floorY) / 8)) % 2 ? "#ffe39a" : "#fffaf0");
  } else if (id === "floor_bath") { // 흰·하늘 타일(줄눈)
    for (let y = floorY; y < h; y += 8) for (let x = 0; x < w; x += 8) {
      rect(ctx, x, y, 8, 8, (Math.floor(x / 8) + Math.floor((y - floorY) / 8)) % 2 ? "#cde8fc" : "#fbfdff");
      rect(ctx, x, y, 8, 1, "#b4d7f0"); rect(ctx, x, y, 1, 8, "#b4d7f0");
    }
  } else if (id === "floor_garden") { // 나무 데크(가로 널판 + 못)
    for (let n = 0, y = floorY; y < h; y += 6, n++) {
      rect(ctx, 0, y, w, 5, n % 2 ? "#d49a62" : "#dca56c"); rect(ctx, 0, y + 5, w, 1, "#9c6a3c");
      for (let x = n % 2 ? 22 : 2; x < w; x += 40) { rect(ctx, x, y, 1, 5, "#9c6a3c"); rect(ctx, x + 2, y + 1, 1, 1, "#a8743f"); rect(ctx, x + 2, y + 3, 1, 1, "#a8743f"); rect(ctx, x + 12, y + 2, 7, 1, "#c88d55"); }
    }
  } else return false;
  return true;
}

// ---------- 러그 ----------
export function drawRugRoom(ctx, cx, rugY, w, id) {
  if (id === "rug_cloud") { // 흰 구름(몽글한 가장자리)
    const R1 = Math.round(Math.min(40, w * 0.3)) - 5, edge = "#d3e0f2", n = 14;
    const bumps = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; bumps.push([Math.round(Math.cos(a) * R1), Math.round(Math.sin(a) * 4)]); }
    for (const [bx, by] of bumps) ellipse(ctx, cx + bx, rugY + by + 1, 5, 3, edge);
    ellipse(ctx, cx, rugY + 1, R1, 5, edge);
    for (const [bx, by] of bumps) ellipse(ctx, cx + bx, rugY + by, 4, 2, P.w);
    ellipse(ctx, cx, rugY, R1, 4, P.w);
    for (const [sx, sy] of [[-18, -1], [6, 1], [20, -2]]) { rect(ctx, cx + sx, rugY + sy, 5, 1, "#e4ecf8"); rect(ctx, cx + sx + 1, rugY + sy - 1, 3, 1, "#e4ecf8"); } // 몽글 주름
  } else if (id === "rug_bathmat") { // 하늘색 욕실 매트 + 흰 꽃
    const half = Math.round(Math.min(26, w * 0.2));
    for (let i = -6; i <= 6; i++) { const a = Math.abs(i), ins = a === 6 ? 2 : a === 5 ? 1 : 0; rect(ctx, cx - half + ins, rugY + i, (half - ins) * 2, 1, "#6fb3ec"); }
    for (let i = -4; i <= 4; i++) { const a = Math.abs(i), ins = a === 4 ? 1 : 0; rect(ctx, cx - half + 2 + ins, rugY + i, (half - 2 - ins) * 2, 1, P.b); }
    for (const [sx, sy] of [[-18, -1], [-7, 2], [5, -2], [16, 1]]) { rect(ctx, cx + sx - 1, rugY + sy, 3, 1, P.w); rect(ctx, cx + sx, rugY + sy - 1, 1, 3, P.w); rect(ctx, cx + sx, rugY + sy, 1, 1, P.y); }
    for (const [sx, sy] of [[-12, -3], [0, 0], [11, 3], [-22, 3], [21, -3]]) rect(ctx, cx + sx, rugY + sy, 1, 1, "#cfeaff");
  } else return false;
  return true;
}

// ---------- 커튼 ----------
// 본체 색 [본바탕, 주름·봉]. 본체 모양은 deco.js drawCurtain과 같음(여기 drawCurtainRoom에도 같은 계산이 있음).
export const CURTAIN_COLORS = {
  curtain_moon: ["#4a5aa8", "#34417f"], // 남색 + 노란 달
  curtain_cafe: [P.w, "#f3cbc0"],        // 흰 바탕 + 빨강 체크
  curtain_drop: [P.b, "#6aaee8"],        // 하늘 + 흰 물방울
  curtain_vine: ["#dff3d3", "#b4dca4"],  // 연두 + 잎 덩굴
};
// drawCurtain과 같은 모양 계산
function curtainGeo(r) {
  const pw = Math.max(7, Math.round(r.w * 0.18)), y0 = r.y - 3, y1 = r.y + r.h + 6, tie = 0.58;
  return { pw, y0, y1, tie, ty: Math.round(y0 + (y1 - y0) * tie) };
}
function curtainRow(r, g, side, y) {
  const t = (y - g.y0) / (g.y1 - g.y0);
  const pinch = t < g.tie ? Math.sin((t / g.tie) * Math.PI / 2) : 1 - ((t - g.tie) / (1 - g.tie)) * 0.55;
  const wdt = Math.max(3, Math.round(g.pw * (1 - 0.55 * pinch)));
  const outer = side < 0 ? r.x - 4 : r.x + r.w + 4;
  return { x: side < 0 ? outer : outer - wdt, wdt, outer };
}
// 커튼 본체(deco.js drawCurtain) 위에 덧무늬만
export function drawCurtainExtra(ctx, r, id) {
  if (!CURTAIN_COLORS[id]) return false;
  const g = curtainGeo(r);
  const skip = (y) => y >= g.ty - 2 && y <= g.ty + 2; // 묶은 끈 자리
  for (const side of [-1, 1]) {
    // 안쪽(가장자리 그늘 1칸 빼고) 칸에만 그린다
    const inside = (y, px) => { if (y < g.y0 || y >= g.y1) return false; const row = curtainRow(r, g, side, y); return side < 0 ? px >= row.x && px <= row.x + row.wdt - 2 : px >= row.x + 1 && px <= row.x + row.wdt - 1; };
    if (id === "curtain_cafe") {
      for (let y = g.y0; y < g.y1; y++) {
        if (skip(y)) continue;
        const row = curtainRow(r, g, side, y);
        for (let px = row.x; px < row.x + row.wdt; px++) {
          if (!inside(y, px)) continue;
          const cb = Math.floor((px - row.outer + 64) / 2) % 2 === 0, rb = Math.floor((y - g.y0) / 2) % 2 === 0;
          if (cb && rb) rect(ctx, px, y, 1, 1, "#ff8a8a"); else if (cb || rb) rect(ctx, px, y, 1, 1, "#ffc8c2");
        }
      }
    } else {
      let n = 0;
      for (let y = g.y0 + 2; y < g.y1 - 2; y += id === "curtain_vine" ? 1 : 6, n++) {
        if (skip(y) || skip(y + 3)) continue;
        const row = curtainRow(r, g, side, y), mid = row.x + Math.floor(row.wdt / 2);
        if (id === "curtain_moon") {
          if (n % 2 === 0 && row.wdt >= 5) { // 작은 초승달(왼쪽이 둥근 C)
            const mx = mid - 1;
            rect(ctx, mx + 1, y, 2, 1, P.y); rect(ctx, mx, y + 1, 1, 2, P.y); rect(ctx, mx + 1, y + 3, 2, 1, P.y);
          } else { const sx = side < 0 ? row.x + 1 : row.x + row.wdt - 2; if (inside(y + 1, sx)) rect(ctx, sx, y + 1, 1, 1, P.y); if (row.wdt >= 5) rect(ctx, mid, y + 3, 1, 1, "#fff3b0"); }
        } else if (id === "curtain_drop") {
          const dx = mid + ((n % 2) ? -1 : 0);
          if (inside(y, dx) && inside(y + 2, dx + 1)) { rect(ctx, dx, y, 1, 1, P.w); rect(ctx, dx - 0, y + 1, 2, 2, P.w); rect(ctx, dx + 1, y + 1, 1, 1, "#e8f5ff"); }
          else if (inside(y + 1, mid)) rect(ctx, mid, y + 1, 1, 1, P.w);
        } else if (id === "curtain_vine") {
          const vx = mid + Math.round(Math.sin((y - g.y0) / 3) * Math.max(0, (row.wdt - 3) / 2 - 0.5));
          if (inside(y, vx)) rect(ctx, vx, y, 1, 1, P.G);
          if ((y - g.y0) % 5 === 0) { const lx = vx + ((Math.floor((y - g.y0) / 5) % 2) ? 1 : -2); if (inside(y, lx) && inside(y, lx + 1)) { rect(ctx, lx, y, 2, 1, P.G); rect(ctx, lx + (lx > vx ? 0 : 1), y - 1, 1, 1, "#8fd694"); } }
        }
      }
    }
  }
  // 위 장식(봉) 덧무늬
  const vy = r.y - 6, vx0 = r.x - 6, vw = r.w + 12;
  if (id === "curtain_moon") { for (let x = vx0 + 3; x < vx0 + vw - 2; x += 8) rect(ctx, x, vy + 1, 1, 1, P.y); }
  else if (id === "curtain_cafe") { for (let x = vx0; x < vx0 + vw; x += 4) rect(ctx, x, vy, 2, 2, "#ff8a8a"); }
  else if (id === "curtain_drop") { for (let x = vx0 + 2; x < vx0 + vw - 1; x += 6) rect(ctx, x, vy + 1, 1, 1, P.w); }
  else if (id === "curtain_vine") { for (let x = vx0 + 1; x < vx0 + vw - 2; x += 6) { rect(ctx, x, vy + 1, 2, 1, P.G); rect(ctx, x + 1, vy, 1, 1, "#8fd694"); } }
  return true;
}
// (편의) 본체까지 한 번에 — deco.js drawCurtain과 같은 모양을 CURTAIN_COLORS 색으로 그리고 덧무늬
export function drawCurtainRoom(ctx, r, id) {
  const cc = CURTAIN_COLORS[id];
  if (!cc) return false;
  const [c1, c2] = cc, g = curtainGeo(r);
  for (const side of [-1, 1]) {
    for (let y = g.y0; y < g.y1; y++) {
      const { x, wdt } = curtainRow(r, g, side, y);
      rect(ctx, x, y, wdt, 1, c1);
      for (let fx = 2; fx < wdt - 1; fx += 3) rect(ctx, side < 0 ? x + fx : x + wdt - 1 - fx, y, 1, 1, c2);
      rect(ctx, side < 0 ? x + wdt - 1 : x, y, 1, 1, c2);
    }
    const outer = side < 0 ? r.x - 4 : r.x + r.w + 4, tw = Math.max(3, Math.round(g.pw * 0.45)) + 1;
    rect(ctx, side < 0 ? outer - 1 : outer - tw, g.ty - 1, tw + 1, 3, P.k); rect(ctx, side < 0 ? outer : outer - tw + 1, g.ty, tw - 1, 1, P.y);
  }
  rect(ctx, r.x - 6, r.y - 6, r.w + 12, 4, c2);
  for (let x = r.x - 6; x < r.x + r.w + 6; x += 4) rect(ctx, x, r.y - 2, 2, 2, c1);
  drawCurtainExtra(ctx, r, id);
  return true;
}

// ---------- 가구 ----------
export const FURN_HALF_ROOM = { bed_wood: 23, bed_star: 24, dresser: 12, table: 21, fridge: 11, oven: 13, tub_wood: 20, tub_bubble: 23, sink: 11, lemon_tree: 13, sunflower: 9, bench: 21 };
// 침대 매트리스 윗면(외곽선 줄)이 base에서 몇 도트 위인지 — 누운 펫의 바닥 y = base - BED_TOP
export const BED_TOP = { bed_wood: 16, bed_star: 16 };

export function drawFurnRoom(ctx, id, x, base, { now = 0, dark = 0, front = false } = {}) {
  const k = P.k;
  if (id === "bed_wood") { // 나무 침대(머리판 왼쪽). front면 이불·발판만(누운 펫 앞에 덮기)
    if (!front) {
      box(ctx, x - 22, base - 30, 7, 30, P.n); rect(ctx, x - 20, base - 26, 3, 20, "#b97c50"); // 머리판 + 판넬
      rect(ctx, x - 23, base - 32, 9, 3, k); rect(ctx, x - 22, base - 31, 7, 1, "#e0ab7d");
      box(ctx, x - 16, base - 11, 33, 8, P.n); rect(ctx, x - 15, base - 5, 31, 1, P.N); // 옆판
      box(ctx, x - 16, base - 16, 33, 6, P.w); rect(ctx, x - 15, base - 12, 31, 1, P.s); // 매트리스
      rbox(ctx, x - 16, base - 21, 12, 6, P.w); rect(ctx, x - 15, base - 17, 10, 1, P.s); rect(ctx, x - 14, base - 20, 3, 1, "#ffffff"); // 베개
    }
    rect(ctx, x - 7, base - 20, 24, 16, k); rect(ctx, x - 6, base - 19, 22, 14, P.b); // 이불(하늘)
    rect(ctx, x - 6, base - 19, 22, 1, "#cfeaff"); rect(ctx, x - 6, base - 15, 22, 1, "#6fb0ea"); // 윗면 빛 · 매트리스 모서리 접힘
    rect(ctx, x - 6, base - 19, 3, 14, P.w); rect(ctx, x - 3, base - 19, 1, 14, k); // 접어 내린 흰 시트
    for (let sx = x; sx < x + 16; sx += 4) rect(ctx, sx, base - 10, 2, 1, "#cfeaff"); // 바느질 무늬
    box(ctx, x + 16, base - 21, 6, 21, P.n); rect(ctx, x + 15, base - 23, 8, 3, k); rect(ctx, x + 16, base - 22, 6, 1, "#e0ab7d"); // 발판
    rect(ctx, x + 18, base - 17, 2, 12, "#b97c50");
  } else if (id === "bed_star") { // 별 침대(남색 둥근 머리판에 노란 별, 연보라 이불)
    const navy = "#3d4f9a";
    if (!front) {
      rect(ctx, x - 23, base - 31, 10, 31, k); ellipse(ctx, x - 18, base - 31, 5, 5, k); ellipse(ctx, x - 18, base - 31, 4, 4, navy); rect(ctx, x - 22, base - 31, 8, 30, navy); // 머리판
      star(ctx, x - 18, base - 32, P.y, P.w); rect(ctx, x - 21, base - 24, 1, 1, P.y); rect(ctx, x - 16, base - 21, 1, 1, P.y); star(ctx, x - 19, base - 15, P.y); rect(ctx, x - 16, base - 9, 1, 1, P.y);
      box(ctx, x - 14, base - 11, 31, 8, P.B); rect(ctx, x - 13, base - 5, 29, 1, navy); // 옆판
      for (let sx = x - 11; sx < x + 15; sx += 6) rect(ctx, sx, base - 8, 1, 1, P.y);
      box(ctx, x - 14, base - 16, 31, 6, P.w); rect(ctx, x - 13, base - 12, 29, 1, P.s); // 매트리스
      rbox(ctx, x - 14, base - 21, 12, 6, P.w); rect(ctx, x - 13, base - 17, 10, 1, P.s); rect(ctx, x - 9, base - 19, 1, 1, P.y); // 베개
    }
    rect(ctx, x - 5, base - 20, 22, 16, k); rect(ctx, x - 4, base - 19, 20, 14, P.v); // 이불(연보라)
    rect(ctx, x - 4, base - 19, 20, 1, "#d4c6ff"); rect(ctx, x - 4, base - 15, 20, 1, P.V);
    rect(ctx, x - 4, base - 19, 3, 14, P.w); rect(ctx, x - 1, base - 19, 1, 14, k);
    for (const [sx, sy] of [[3, -17], [10, -12], [4, -9], [13, -17]]) rect(ctx, x + sx, base + sy, 1, 1, P.w);
    star(ctx, x + 8, base - 17, P.y); star(ctx, x + 12, base - 8, "#fff3b0");
    rect(ctx, x + 15, base - 22, 8, 22, k); ellipse(ctx, x + 19, base - 22, 4, 3, k); ellipse(ctx, x + 19, base - 22, 3, 2, navy); rect(ctx, x + 16, base - 22, 6, 21, navy); // 발판
    star(ctx, x + 19, base - 16, P.y, P.w); rect(ctx, x + 18, base - 8, 1, 1, P.y);
  } else if (id === "dresser") { // 분홍 서랍장 3단
    rect(ctx, x - 10, base - 2, 3, 2, P.N); rect(ctx, x + 7, base - 2, 3, 2, P.N);
    box(ctx, x - 11, base - 26, 22, 25, P.p);
    rect(ctx, x - 12, base - 28, 24, 3, k); rect(ctx, x - 11, base - 27, 22, 1, P.P); // 윗판
    for (const dy of [-25, -17, -9]) {
      rect(ctx, x - 9, base + dy + 1, 18, 6, "#ffc2cf"); rect(ctx, x - 9, base + dy + 6, 18, 1, P.P); // 서랍 앞면 + 아래 그늘
      const cy = base + dy + 3; // 동그란 손잡이
      rect(ctx, x - 1, cy - 1, 2, 1, k); rect(ctx, x - 2, cy, 1, 2, k); rect(ctx, x + 1, cy, 1, 2, k); rect(ctx, x - 1, cy + 2, 2, 1, k); rect(ctx, x - 1, cy, 2, 2, P.y);
    }
    rect(ctx, x - 10, base - 18, 20, 1, k); rect(ctx, x - 10, base - 10, 20, 1, k); // 서랍 사이
    rbox(ctx, x + 3, base - 33, 5, 5, P.b); rect(ctx, x + 4, base - 32, 1, 2, P.w); // 위에 작은 꽃병
    rect(ctx, x + 5, base - 36, 1, 3, P.G); rect(ctx, x + 4, base - 37, 3, 1, P.p); rect(ctx, x + 5, base - 38, 1, 1, P.p);
  } else if (id === "table") { // 동그란 식탁(빨강 체크 식탁보) + 의자 1개(오른쪽)
    // 의자(식탁 쪽을 보는 옆모습)
    rect(ctx, x + 11, base - 10, 2, 10, k); rect(ctx, x + 17, base - 10, 2, 10, k);
    box(ctx, x + 16, base - 25, 4, 15, P.n); rect(ctx, x + 15, base - 27, 6, 3, k); rect(ctx, x + 16, base - 26, 4, 1, "#e0ab7d");
    box(ctx, x + 9, base - 13, 11, 4, P.n); rect(ctx, x + 10, base - 12, 6, 1, P.r); // 좌석 + 방석
    // 식탁
    const tx = x - 5;
    box(ctx, tx - 2, base - 11, 4, 9, P.N); box(ctx, tx - 7, base - 3, 14, 3, P.N); rect(ctx, tx - 6, base - 2, 12, 1, P.n); // 기둥·받침
    rect(ctx, tx - 15, base - 20, 30, 10, k);
    for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 28; xx++) {
      const cb = Math.floor(xx / 2) % 2 === 0, rb = Math.floor((yy + 1) / 2) % 2 === 0;
      rect(ctx, tx - 14 + xx, base - 19 + yy, 1, 1, cb && rb ? P.r : cb || rb ? "#ffc0b8" : P.w);
    }
    rect(ctx, tx - 14, base - 19, 28, 1, "#ffe9e4"); // 식탁 윗면 빛
    for (let xx = 0; xx < 30; xx += 4) rect(ctx, tx - 15 + xx + 1, base - 10, 2, 1, k); // 물결 끝단
    for (let xx = 0; xx < 28; xx += 4) rect(ctx, tx - 14 + xx + 1, base - 11, 2, 1, P.r);
    box(ctx, tx + 4, base - 24, 5, 5, P.w); rect(ctx, tx + 9, base - 23, 1, 2, k); rect(ctx, tx + 5, base - 23, 3, 1, P.o); // 컵
    rect(ctx, tx - 10, base - 21, 10, 2, k); rect(ctx, tx - 9, base - 21, 8, 1, P.W); // 접시
    rbox(ctx, tx - 8, base - 25, 6, 5, P.o); rect(ctx, tx - 7, base - 24, 2, 1, P.y); // 빵
  } else if (id === "fridge") { // 민트 냉장고(키 34) + 하트 자석
    rect(ctx, x - 9, base - 2, 3, 2, k); rect(ctx, x + 6, base - 2, 3, 2, k);
    rbox(ctx, x - 10, base - 35, 20, 34, P.g);
    rect(ctx, x + 8, base - 34, 1, 32, "#6fc28a"); rect(ctx, x - 9, base - 33, 1, 8, "#c8f0cb"); rect(ctx, x - 9, base - 21, 1, 15, "#c8f0cb"); // 그늘·빛
    rect(ctx, x - 9, base - 24, 18, 1, k); // 냉동칸 문
    box(ctx, x + 4, base - 31, 3, 5, P.W); box(ctx, x + 4, base - 21, 3, 8, P.W); // 손잡이
    const hx = x - 6, hy = base - 31; // 하트 자석
    rect(ctx, hx, hy, 2, 1, P.r); rect(ctx, hx + 3, hy, 2, 1, P.r); rect(ctx, hx, hy + 1, 5, 1, P.r); rect(ctx, hx + 1, hy + 2, 3, 1, P.r); rect(ctx, hx + 2, hy + 3, 1, 1, P.r); rect(ctx, hx, hy, 1, 1, P.w);
    box(ctx, x - 7, base - 20, 7, 8, P.w); rect(ctx, x - 6, base - 18, 4, 1, P.L); rect(ctx, x - 6, base - 16, 5, 1, P.L); // 메모
    rect(ctx, x - 4, base - 21, 2, 2, P.y); // 메모 위 동그란 자석
  } else if (id === "oven") { // 빵 오븐(주황 창 안에서 빵이 천천히 부풂)
    rect(ctx, x - 11, base - 2, 3, 2, k); rect(ctx, x + 8, base - 2, 3, 2, k);
    rect(ctx, x - 8, base - 27, 6, 1, k); rect(ctx, x + 2, base - 27, 6, 1, k); // 위 화구
    rbox(ctx, x - 12, base - 26, 24, 25, P.w);
    rect(ctx, x - 11, base - 25, 22, 5, "#f1e2d2"); rect(ctx, x - 11, base - 20, 22, 1, k); // 조작판
    for (const kx of [-8, -4, 0]) { rect(ctx, x + kx, base - 24, 2, 3, k); rect(ctx, x + kx, base - 23, 2, 1, P.L); }
    rect(ctx, x + 6, base - 23, 2, 2, dark > 0.25 || Math.floor(now / 900) % 2 ? P.r : P.P); // 켜짐 불빛
    rect(ctx, x - 6, base - 18, 12, 2, k); rect(ctx, x - 5, base - 18, 10, 1, P.L); // 문 손잡이
    rect(ctx, x - 9, base - 15, 18, 11, k); rect(ctx, x - 8, base - 14, 16, 9, P.o); rect(ctx, x - 7, base - 13, 14, 3, "#ffd08a"); // 주황 창
    rect(ctx, x - 8, base - 7, 16, 1, P.O); // 선반
    const rise = Math.round((Math.sin(now / 2400) + 1)); // 0~2 도트
    const by = base - 8; // 빵 바닥
    rect(ctx, x - 5, by - 3 - rise, 10, 3 + rise, P.N); rect(ctx, x - 4, by - 4 - rise, 8, 1, P.N); // 빵 테두리(진갈색)
    rect(ctx, x - 4, by - 3 - rise, 8, 2 + rise, P.n); rect(ctx, x - 3, by - 3 - rise, 3, 1, "#e6b38a");
    rect(ctx, x - 2, by - 2 - rise, 1, 1, P.N); rect(ctx, x + 1, by - 2 - rise, 1, 1, P.N); // 칼집
    rect(ctx, x - 11, base - 3, 22, 1, P.s);
  } else if (id === "tub_wood") { // 나무통 욕조(김이 모락)
    const lw = "#e0ab7d";
    rbox(ctx, x - 18, base - 19, 36, 19, P.n);
    for (let sx = x - 13; sx < x + 17; sx += 5) rect(ctx, sx, base - 18, 1, 17, "#b37a4c"); // 통 널
    for (const by of [-16, -7]) { rect(ctx, x - 18, by + base, 36, 3, k); rect(ctx, x - 17, by + base + 1, 34, 1, P.L); rect(ctx, x - 15, by + base + 1, 4, 1, P.W); } // 쇠테
    rect(ctx, x - 19, base - 22, 38, 4, k); rect(ctx, x - 18, base - 21, 36, 2, lw); // 테두리
    rect(ctx, x - 16, base - 21, 32, 1, P.b); rect(ctx, x - 14 + (Math.floor(now / 700) % 3) * 9, base - 21, 3, 1, "#cfeaff"); // 물
    for (let i = 0; i < 3; i++) { // 김(2도트 위로 흐릿하게)
      const ph = ((now / 2600) + i / 3) % 1, sx = x - 9 + i * 9 + Math.round(Math.sin(ph * 6 + i)), sy = base - 25 - Math.round(ph * 8);
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.85; rect(ctx, sx, sy, 1, 2, P.W); rect(ctx, sx + 1, sy - 2, 1, 2, P.W); rect(ctx, sx, sy - 4, 1, 2, P.W); ctx.globalAlpha = 1;
    }
  } else if (id === "tub_bubble") { // 흰 거품 욕조(흰 다리, 방울이 올라옴)
    for (const fx of [-15, 11]) { rbox(ctx, x + fx, base - 6, 5, 6, P.w); rect(ctx, x + fx + 1, base - 2, 3, 1, P.s); } // 다리
    blob(ctx, x - 20, base - 19, 40, 14, (xx, yy) => { const ins = yy >= 10 ? (yy - 9) * 2 : 0; return xx >= ins && xx < 40 - ins; }, (xx, yy) => (yy >= 11 ? P.s : yy === 0 ? "#ffffff" : P.w));
    rect(ctx, x - 17, base - 15, 1, 6, P.W);
    rect(ctx, x - 22, base - 28, 3, 9, k); rect(ctx, x - 21, base - 27, 1, 7, P.Y); rect(ctx, x - 22, base - 29, 6, 3, k); rect(ctx, x - 21, base - 28, 4, 1, P.y); // 수도꼭지
    const foam = [[-12, 4], [-5, 5], [3, 4], [10, 5], [16, 3]]; // 몽글 거품(테두리 위로 봉긋)
    for (const [fx, rr] of foam) ellipse(ctx, x + fx, base - 22, rr + 1, rr, k);
    for (const [fx, rr] of foam) { ellipse(ctx, x + fx, base - 22, rr, rr - 1, P.w); rect(ctx, x + fx - rr + 2, base - 20, rr * 2 - 3, 1, "#e3f1ff"); rect(ctx, x + fx - 2, base - 24 - (rr > 4 ? 1 : 0), 2, 1, "#ffffff"); rect(ctx, x + fx - 3, base - 23 - (rr > 4 ? 1 : 0), 1, 1, "#ffffff"); }
    rect(ctx, x - 22, base - 20, 44, 3, k); rect(ctx, x - 21, base - 19, 42, 1, "#ffffff"); // 테두리(거품 앞)
    for (let i = 0; i < 3; i++) { // 올라오는 방울
      const ph = ((now / 3000) + i / 3) % 1, bx = x - 8 + i * 8 + Math.round(Math.sin(ph * 5 + i * 2)), by = base - 28 - Math.round(ph * 12);
      ctx.globalAlpha = Math.min(1, Math.sin(ph * Math.PI) * 1.4);
      rect(ctx, bx, by - 1, 2, 1, P.B); rect(ctx, bx - 1, by, 1, 2, P.B); rect(ctx, bx + 2, by, 1, 2, P.B); rect(ctx, bx, by + 2, 2, 1, P.B); rect(ctx, bx, by, 1, 1, P.w);
      ctx.globalAlpha = 1;
    }
  } else if (id === "sink") { // 흰 세면대 + 동그란 거울
    ellipse(ctx, x, base - 34, 7, 7, k); ellipse(ctx, x, base - 34, 6, 6, P.Y); ellipse(ctx, x, base - 34, 5, 5, "#cfeaff"); // 거울
    rect(ctx, x - 3, base - 37, 1, 2, P.w); rect(ctx, x - 2, base - 38, 1, 1, P.w); rect(ctx, x + 2, base - 32, 1, 1, P.w);
    rect(ctx, x, base - 43, 1, 2, P.k);
    box(ctx, x - 3, base - 17, 6, 15, P.w); rect(ctx, x + 1, base - 16, 1, 13, P.s); // 기둥
    rbox(ctx, x - 5, base - 3, 10, 3, P.w);
    rect(ctx, x - 1, base - 25, 3, 4, k); rect(ctx, x, base - 24, 1, 3, P.L); rect(ctx, x - 1, base - 26, 5, 2, k); rect(ctx, x, base - 25, 3, 1, P.W); // 수도꼭지
    blob(ctx, x - 10, base - 21, 20, 6, (xx, yy) => { const ins = yy >= 3 ? (yy - 2) * 2 : 0; return xx >= ins && xx < 20 - ins; }, (xx, yy) => (yy === 0 ? "#ffffff" : yy >= 4 ? P.s : P.w)); // 세면대
    rect(ctx, x - 8, base - 20, 16, 1, "#cfeaff");
    rbox(ctx, x + 5, base - 24, 4, 3, P.p); // 비누
  } else if (id === "lemon_tree") { // 레몬 나무(키 38, 레몬 3개)
    rect(ctx, x - 1, base - 22, 3, 12, k); rect(ctx, x, base - 22, 1, 11, P.N); // 줄기
    ellipse(ctx, x, base - 28, 12, 10, k); ellipse(ctx, x, base - 28, 11, 9, P.G);
    for (const [dx, dy] of [[-5, -33], [3, -35], [-8, -27], [6, -28], [-2, -24]]) { rect(ctx, x + dx, base + dy, 3, 2, P.g); rect(ctx, x + dx + 1, base + dy - 1, 1, 1, P.g); }
    for (const [lx, ly] of [[-6, -26], [5, -31], [3, -22]]) { rbox(ctx, x + lx - 2, base + ly - 2, 5, 4, P.y); rect(ctx, x + lx - 1, base + ly - 1, 1, 1, P.w); rect(ctx, x + lx + 1, base + ly, 1, 1, P.Y); }
    box(ctx, x - 6, base - 10, 12, 10, P.b); rect(ctx, x - 5, base - 6, 10, 1, P.w); rect(ctx, x - 5, base - 9, 10, 1, P.B); // 화분
    rect(ctx, x - 7, base - 12, 14, 3, k); rect(ctx, x - 6, base - 11, 12, 1, P.b);
  } else if (id === "sunflower") { // 해바라기 화분(2송이, 살랑)
    const sway = Math.round(Math.sin(now / 1100));
    const heads = [[-3, -24, sway], [4, -17, -sway]];
    for (const [hx, hy, s] of heads) { // 줄기(위로 갈수록 살랑)
      for (let yy = base - 8; yy > base + hy; yy--) { const t = (base - 8 - yy) / (-hy - 8); rect(ctx, x + hx + Math.round(s * t), yy, 1, 1, P.G); }
    }
    rect(ctx, x - 5, base - 14, 2, 1, P.G); rect(ctx, x - 6, base - 15, 2, 1, P.g); rect(ctx, x + 5, base - 11, 2, 1, P.G); rect(ctx, x + 6, base - 12, 2, 1, P.g); // 잎
    for (const [hx, hy, s] of heads) {
      const cx = x + hx + s, cy = base + hy;
      ellipse(ctx, cx, cy, 5, 5, k); ellipse(ctx, cx, cy, 4, 4, P.y);
      for (const [px, py] of [[0, -4], [0, 3], [-4, 0], [3, 0]]) rect(ctx, cx + px, cy + py, 1, 1, P.Y);
      ellipse(ctx, cx, cy, 2, 2, P.N); rect(ctx, cx - 1, cy - 1, 1, 1, P.n);
    }
    rbox(ctx, x - 5, base - 8, 10, 8, P.o); rect(ctx, x - 4, base - 7, 8, 2, P.O); // 화분
  } else if (id === "bench") { // 하얀 나무 정원 벤치
    for (const lx of [-18, 15]) { box(ctx, x + lx, base - 10, 3, 10, P.w); rect(ctx, x + lx + 1, base - 9, 1, 9, P.s); } // 다리
    box(ctx, x - 15, base - 27, 30, 4, P.w); box(ctx, x - 15, base - 21, 30, 4, P.w); // 등받이 널
    rect(ctx, x - 14, base - 24, 28, 1, P.s); rect(ctx, x - 14, base - 18, 28, 1, P.s);
    for (const lx of [-18, 15]) { box(ctx, x + lx, base - 29, 3, 17, P.w); rect(ctx, x + lx - 1, base - 30, 5, 2, k); } // 기둥
    box(ctx, x - 20, base - 13, 40, 4, P.w); rect(ctx, x - 19, base - 11, 38, 1, P.s); // 좌석
    for (const sx of [-7, 6]) rect(ctx, x + sx, base - 12, 1, 2, P.S);
    box(ctx, x - 21, base - 19, 5, 3, P.w); box(ctx, x + 16, base - 19, 5, 3, P.w); // 팔걸이
    rect(ctx, x - 20, base - 16, 2, 3, k); rect(ctx, x + 18, base - 16, 2, 3, k);
  } else return false;
  return true;
}

// ---------- 작은 칸: 창가(sill_*)·벽걸이(hang_*)·바닥 소품(prop_*) ----------
// opts: { now, wall, dark, days(0~30, 새싹) }
export function drawSmallRoom(ctx, id, x, base, { now = 0, wall = Date.now(), dark = 0, days = 0 } = {}) {
  const k = P.k;
  if (id === "sill_moon") { // 노란 초승달 무드등(어두우면 은은히)
    const lit = dark > 0.25;
    if (lit) { const a = Math.min(0.4, dark * 0.55); for (let r = 12; r > 3; r -= 3) ellipse(ctx, x, base - 9, r, r, `rgba(255,226,140,${a * (1 - r / 14)})`); }
    rbox(ctx, x - 4, base - 3, 9, 3, P.n); rect(ctx, x - 3, base - 2, 7, 1, P.N); // 받침
    rect(ctx, x, base - 4, 1, 1, k);
    blob(ctx, x - 5, base - 14, 10, 10, (xx, yy) => ((xx - 4.5) ** 2 + (yy - 4.5) ** 2 <= 23) && !((xx - 7) ** 2 + (yy - 3.5) ** 2 <= 15), (xx, yy) => (lit ? (xx < 2 ? "#ffe680" : "#fff3b0") : xx < 2 ? P.Y : P.y));
    rect(ctx, x + 3, base - 13, 1, 1, lit ? "#fff3b0" : P.y); rect(ctx, x + 4, base - 7, 1, 1, lit ? "#fff3b0" : P.y); // 작은 별
  } else if (id === "sill_herb") { // 허브 화분 3개
    const pots = [[-5, P.o], [0, P.w], [5, P.b]];
    // 바질(둥근 잎)
    blob(ctx, x - 7, base - 10, 5, 4, (xx, yy) => inEll(xx, yy, 2, 1.8, 2.6, 2.1), (xx, yy) => (xx + yy < 3 ? P.g : P.G));
    // 로즈마리(가는 줄기)
    for (const [sx, h] of [[-1, 8], [1, 7]]) { rect(ctx, x + sx, base - 4 - h, 1, h, P.G); for (let yy = 1; yy < h; yy += 2) rect(ctx, x + sx + (yy % 4 === 1 ? -1 : 1), base - 4 - h + yy, 1, 1, P.g); }
    // 민트(작은 잎 + 흰 꽃)
    blob(ctx, x + 3, base - 9, 5, 4, (xx, yy) => inEll(xx, yy, 2, 2, 2.6, 2.2), P.g);
    rect(ctx, x + 4, base - 8, 1, 1, P.G); rect(ctx, x + 6, base - 7, 1, 1, P.G); rect(ctx, x + 5, base - 10, 1, 1, P.w);
    for (const [dx, c] of pots) { rbox(ctx, x + dx - 2, base - 5, 5, 5, c); rect(ctx, x + dx - 1, base - 4, 3, 1, c === P.w ? P.s : c === P.o ? P.O : P.B); }
  } else if (id === "sill_duck") { // 고무 오리(왼쪽을 봄)
    blob(ctx, x - 5, base - 11, 11, 11, (xx, yy) => inEll(xx, yy, 6, 8, 4.6, 2.6) || inEll(xx, yy, 3, 3, 2.6, 2.6) || (xx >= 9 && xx <= 10 && yy >= 5 && yy <= 7), (xx, yy) => (yy >= 9 ? P.Y : P.y));
    rect(ctx, x - 7, base - 8, 3, 1, k); rect(ctx, x - 7, base - 7, 2, 1, P.o); rect(ctx, x - 6, base - 6, 1, 1, k); rect(ctx, x - 7, base - 9, 2, 1, k); // 부리
    rect(ctx, x - 7, base - 8, 1, 1, P.O);
    rect(ctx, x - 3, base - 10, 1, 1, k); rect(ctx, x - 4, base - 9, 1, 1, P.R); // 눈·볼
    rect(ctx, x, base - 4, 4, 1, P.Y); rect(ctx, x + 1, base - 5, 3, 1, P.Y); // 날개
    rect(ctx, x - 3, base - 12, 1, 1, P.w);
  } else if (id === "sill_sprout") { // 새싹 상자(days 0→30 자람)
    const g = Math.max(0, Math.min(1, days / 30));
    const sprouts = [[-4, 4], [0, 6], [4, 5]];
    for (const [dx, full] of sprouts) {
      const h = Math.round(g * full), sx = x + dx, top = base - 6 - h;
      if (h <= 0) { rect(ctx, sx - 1, base - 7, 3, 1, P.N); continue; } // 아직 씨앗(흙 둔덕)
      rect(ctx, sx, top, 1, h, P.G);
      rect(ctx, sx - 1, top - 1, 1, 1, P.g); rect(ctx, sx + 1, top - 1, 1, 1, P.g); rect(ctx, sx, top - 1, 1, 1, P.G); // 떡잎
      if (g >= 0.5) { rect(ctx, sx - 2, top - 2, 2, 1, P.g); rect(ctx, sx + 1, top - 2, 2, 1, P.g); }
      if (g >= 1 && dx === 0) rect(ctx, sx, top - 3, 1, 1, P.p); // 다 자라면 꽃봉오리
    }
    box(ctx, x - 7, base - 6, 15, 6, P.n); rect(ctx, x - 6, base - 5, 13, 1, P.N); rect(ctx, x - 6, base - 3, 13, 1, "#b37a4c"); // 나무 상자 + 흙
    rect(ctx, x - 3, base - 2, 1, 1, P.N); rect(ctx, x + 3, base - 2, 1, 1, P.N);
  } else if (id === "hang_dream") { // 드림캐처(고리 + 깃털 3개). base = 가운데
    rect(ctx, x, base - 9, 1, 4, P.N); rect(ctx, x, base - 10, 1, 1, k);
    blob(ctx, x - 4, base - 4, 9, 9, (xx, yy) => { const d = (xx - 4) ** 2 + (yy - 4) ** 2; return d <= 20.5 && d > 7; }, (xx, yy) => ((xx + yy) % 3 === 0 ? P.v : P.n));
    for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0], [-1, -1], [1, 1], [1, -1], [-1, 1]]) rect(ctx, x + dx, base + dy, 1, 1, P.w);
    rect(ctx, x, base, 1, 1, P.p);
    const sw = Math.round(Math.sin(now / 1300) * 0.6);
    for (const [dx, len, c] of [[-4, 2, P.p], [0, 4, P.b], [4, 2, P.v]]) {
      const fx = x + dx + (dx === 0 ? 0 : sw), fy = base + 4 + len;
      rect(ctx, x + dx, base + 4, 1, len, P.w); // 실
      rbox(ctx, fx - 1, fy, 4, 7, c); rect(ctx, fx, fy + 1, 1, 4, P.w); rect(ctx, fx + 1, fy + 5, 1, 1, P.w); // 깃털 + 깃대
    }
  } else if (id === "hang_ladle") { // 국자·뒤집개 걸이. base = 가운데
    rect(ctx, x - 9, base - 8, 19, 3, k); rect(ctx, x - 8, base - 7, 17, 1, P.n); rect(ctx, x - 8, base - 7, 1, 1, P.N); rect(ctx, x + 8, base - 7, 1, 1, P.N); // 걸이 봉
    // 국자
    rect(ctx, x - 5, base - 5, 3, 9, k); rect(ctx, x - 4, base - 5, 1, 8, P.L);
    blob(ctx, x - 7, base + 3, 7, 4, (xx, yy) => inEll(xx, yy, 3, 0.5, 3.6, 3.2) && yy >= 0, (xx, yy) => (yy === 0 ? P.W : P.L));
    // 뒤집개
    rect(ctx, x + 2, base - 5, 3, 7, k); rect(ctx, x + 3, base - 5, 1, 6, P.n);
    rbox(ctx, x + 1, base + 1, 5, 7, P.W); rect(ctx, x + 2, base + 3, 1, 3, P.L); rect(ctx, x + 4, base + 3, 1, 3, P.L);
    rect(ctx, x - 4, base - 6, 1, 1, P.Y); rect(ctx, x + 3, base - 6, 1, 1, P.Y); // 고리
  } else if (id === "hang_towel") { // 분홍·하늘 수건 2장. base = 가운데
    rect(ctx, x - 10, base - 8, 2, 4, k); rect(ctx, x + 9, base - 8, 2, 4, k); // 받침
    for (const [tx, len, c, sh] of [[-8, 13, P.p, P.P], [1, 11, P.b, P.B]]) {
      box(ctx, x + tx, base - 7, 8, len, c);
      rect(ctx, x + tx + 1, base - 6, 6, 2, sh); // 봉에 걸친 접힘
      rect(ctx, x + tx + 1, base - 7 + len - 4, 6, 1, P.w); // 줄무늬
      for (let fx = 1; fx < 7; fx += 2) rect(ctx, x + tx + fx, base - 7 + len, 1, 1, c); // 술
    }
    rect(ctx, x - 9, base - 7, 19, 1, k); rect(ctx, x - 8, base - 7, 17, 1, P.L); // 봉
  } else if (id === "hang_bird") { // 새집(빨강 지붕, 가끔 아기새). base = 가운데
    rect(ctx, x, base - 13, 1, 4, P.N);
    box(ctx, x - 5, base - 4, 11, 10, P.n); rect(ctx, x - 4, base + 4, 9, 1, P.N); // 몸통
    blob(ctx, x - 6, base - 9, 13, 6, (xx, yy) => Math.abs(xx - 6) <= yy * 1.2 + 0.8, (xx, yy) => (yy >= 5 ? P.P : P.r)); // 지붕
    rect(ctx, x - 1, base - 1, 3, 3, k); // 구멍
    if (Math.floor(now / 1700) % 5 === 0) { rect(ctx, x - 1, base - 1, 3, 2, P.y); rect(ctx, x, base - 1, 1, 1, k); rect(ctx, x + 2, base, 1, 1, P.o); } // 아기새 고개
    rect(ctx, x - 1, base + 3, 3, 1, P.N); rect(ctx, x, base + 4, 1, 1, P.N); // 횃대
  } else if (id === "prop_slipper") { // 토끼 슬리퍼 한 켤레
    for (const sx of [x - 4, x + 4]) {
      for (const ex of [sx - 2, sx + 2]) { rbox(ctx, ex - 1, base - 10, 3, 6, P.w); rect(ctx, ex, base - 9, 1, 3, P.p); } // 귀
      blob(ctx, sx - 3, base - 5, 7, 5, (xx, yy) => inEll(xx, yy, 3, 2.4, 3.6, 2.6), (xx, yy) => (yy >= 4 ? P.W : P.w));
      rect(ctx, sx - 1, base - 3, 1, 1, k); rect(ctx, sx + 1, base - 3, 1, 1, k); rect(ctx, sx, base - 2, 1, 1, P.p);
    }
  } else if (id === "prop_basket") { // 과일 바구니(사과·바나나)
    for (let xx = -5; xx <= 5; xx++) rect(ctx, x + xx, base - 6 - Math.round(Math.sqrt(Math.max(0, 1 - (xx / 5.5) ** 2)) * 7), 1, 1, P.N); // 손잡이
    blob(ctx, x + 1, base - 11, 6, 6, (xx, yy) => (Math.abs(xx - 2.5 + (yy - 5) * 0.55) <= 1.2 + (yy > 2 ? 0.6 : 0)) && yy <= 5, P.y); // 바나나
    rect(ctx, x + 5, base - 12, 1, 1, P.N);
    blob(ctx, x - 5, base - 11, 6, 6, (xx, yy) => inEll(xx, yy, 2.5, 2.5, 3.1, 3.1), (xx, yy) => (xx + yy < 3 ? P.p : P.r)); // 사과
    rect(ctx, x - 2, base - 13, 1, 2, P.N); rect(ctx, x - 1, base - 13, 2, 1, P.G);
    blob(ctx, x - 6, base - 6, 13, 6, (xx, yy) => { const ins = yy >= 4 ? yy - 3 : 0; return xx >= ins && xx < 13 - ins; }, (xx, yy) => (yy === 0 ? "#e0ab7d" : (xx + yy) % 2 ? P.n : "#b37a4c")); // 바구니
  } else if (id === "prop_bubble") { // 비눗방울 병(방울이 둥실)
    rect(ctx, x + 1, base - 15, 1, 5, P.v); rect(ctx, x, base - 18, 3, 1, P.v); rect(ctx, x - 1, base - 17, 1, 2, P.v); rect(ctx, x + 3, base - 17, 1, 2, P.v); rect(ctx, x, base - 15, 3, 1, P.v); // 방울 막대
    box(ctx, x - 3, base - 11, 7, 3, P.p); // 뚜껑
    rbox(ctx, x - 4, base - 9, 9, 9, "#dff1ff"); rect(ctx, x - 3, base - 5, 7, 4, "#ffc8d6"); rect(ctx, x - 3, base - 8, 1, 3, P.w); // 병 + 비눗물
    rect(ctx, x - 1, base - 4, 3, 2, P.w);
    for (let i = 0; i < 3; i++) { // 둥실 오르는 방울
      const ph = ((now / 3200) + i / 3) % 1, bx = x + 4 + i * 2 + Math.round(Math.sin(ph * 5 + i) * 1.5), by = base - 17 - Math.round(ph * 12);
      ctx.globalAlpha = Math.min(1, Math.sin(ph * Math.PI) * 1.5);
      rect(ctx, bx, by - 1, 2, 1, P.B); rect(ctx, bx - 1, by, 1, 2, P.B); rect(ctx, bx + 2, by, 1, 2, P.B); rect(ctx, bx, by + 2, 2, 1, P.B); rect(ctx, bx, by, 1, 1, P.w);
      ctx.globalAlpha = 1;
    }
  } else if (id === "prop_can") { // 하늘색 물뿌리개
    for (let i = 0; i < 6; i++) rect(ctx, x - 5 - i, base - 6 - i, 3, 3, k); // 주둥이 외곽
    for (let i = 0; i < 6; i++) rect(ctx, x - 4 - i, base - 5 - i, 1, 1, P.b);
    rbox(ctx, x - 13, base - 14, 4, 4, P.B); rect(ctx, x - 12, base - 13, 1, 1, P.w); // 꼭지
    rect(ctx, x - 2, base - 12, 7, 1, k); rect(ctx, x - 3, base - 11, 1, 3, k); rect(ctx, x + 5, base - 11, 1, 3, k); rect(ctx, x - 2, base - 11, 7, 1, P.B); // 손잡이
    rbox(ctx, x - 5, base - 9, 11, 9, P.b); rect(ctx, x - 4, base - 2, 9, 1, P.B); rect(ctx, x - 3, base - 7, 1, 3, P.w); // 몸통
    rect(ctx, x + 1, base - 6, 3, 2, "#cfeaff");
  } else return false;
  return true;
}
