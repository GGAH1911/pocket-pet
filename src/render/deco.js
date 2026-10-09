// 방 꾸미기 그림: 벽지·바닥·러그·커튼·가구. 상점 미리보기(작은 그림)도 같은 함수로 그린다.
// 좌표는 캔버스 논리 픽셀. 가구는 x(가운데)·base(바닥에 닿는 y) 기준.
import { PALETTE } from "./palette.js?v=9326bfc-1791552396";
import { SPRITES, drawSprite, spriteSize } from "./sprites.js?v=9326bfc-1791552396";
import { ROOM_WALLS, drawWallRoom, drawFloorRoom, drawRugRoom, CURTAIN_COLORS, drawCurtainExtra, FURN_HALF_ROOM, drawFurnRoom, drawSmallRoom } from "./deco-rooms.js?v=9326bfc-1791552396"; // 새 방 4개 그림(2026-10-09)

export const HAT_SPRITE = { hat_ribbon: "hatRibbon", hat_straw: "hatStraw", hat_glasses: "hatGlasses", hat_crown: "hatCrown", hat_flower: "hatFlower" };

const P = PALETTE;
const rect = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const ellipse = (ctx, cx, cy, rx, ry, c) => { for (let i = -ry; i <= ry; i++) { const hw = Math.round(Math.sqrt(Math.max(0, 1 - (i / ry) ** 2)) * rx); rect(ctx, cx - hw, cy + i, hw * 2, 1, c); } };

// ---------- 벽지 ----------
export const WALL_BASE = { wall_basic: P.c, wall_berry: "#ffe6ee", wall_cloud: "#dceeff", wall_night: "#3d4f9a", wall_leaf: "#e2f4dc" };
export function drawWall(ctx, w, floorY, id = "wall_basic") {
  if (ROOM_WALLS[id] && drawWallRoom(ctx, w, floorY, id)) return;
  rect(ctx, 0, 0, w, floorY, WALL_BASE[id] || P.c);
  if (id === "wall_berry") {
    for (let y = 6; y < floorY - 6; y += 12) for (let x = (y / 12) % 2 ? 10 : 3; x < w; x += 14) { rect(ctx, x, y + 1, 3, 3, P.r); rect(ctx, x + 1, y + 4, 1, 1, P.r); rect(ctx, x, y, 3, 1, P.G); rect(ctx, x + 1, y + 2, 1, 1, P.w); }
  } else if (id === "wall_cloud") {
    for (let y = 8; y < floorY - 8; y += 16) for (let x = (y / 16) % 2 ? 14 : 2; x < w; x += 26) { rect(ctx, x, y + 2, 10, 3, P.w); rect(ctx, x + 2, y, 5, 2, P.w); }
  } else if (id === "wall_night") {
    for (let y = 5; y < floorY - 5; y += 10) for (let x = (y / 10) % 2 ? 9 : 2; x < w; x += 13) { rect(ctx, x, y, 1, 1, P.y); if ((x + y) % 3 === 0) { rect(ctx, x - 1, y, 3, 1, P.y); rect(ctx, x, y - 1, 1, 3, P.y); } }
  } else if (id === "wall_leaf") {
    for (let y = 6; y < floorY - 6; y += 12) for (let x = (y / 12) % 2 ? 9 : 2; x < w; x += 13) { rect(ctx, x, y, 3, 2, P.g); rect(ctx, x + 1, y - 1, 2, 1, P.g); rect(ctx, x + 1, y + 2, 1, 2, P.G); }
  } else {
    ctx.fillStyle = "#ffd6bd";
    for (let y = 6; y < floorY - 6; y += 12) for (let x = (y / 12) % 2 ? 10 : 4; x < w; x += 12) ctx.fillRect(x, y, 2, 2);
  }
}

// ---------- 바닥 ----------
export function drawFloor(ctx, w, h, floorY, id = "floor_wood") {
  if (drawFloorRoom(ctx, w, h, floorY, id)) return;
  if (id === "floor_check") {
    for (let y = floorY; y < h; y += 8) for (let x = 0; x < w; x += 8) rect(ctx, x, y, 8, 8, (Math.floor(x / 8) + Math.floor((y - floorY) / 8)) % 2 ? "#efd9bd" : "#fffaf2"); // 칸 번호로 번갈아(바닥 시작 위치와 무관)
  } else if (id === "floor_carpet") {
    rect(ctx, 0, floorY, w, h - floorY, "#e4d2fb");
    for (let y = floorY + 4; y < h; y += 6) for (let x = (y % 12) ? 2 : 5; x < w; x += 6) rect(ctx, x, y, 1, 1, "#d2baf5");
  } else if (id === "floor_grass") {
    rect(ctx, 0, floorY, w, h - floorY, "#a6dc93");
    for (let y = floorY + 3; y < h; y += 7) for (let x = (y % 14) ? 1 : 6; x < w; x += 9) { rect(ctx, x, y, 1, 2, P.G); rect(ctx, x + 2, y + 1, 1, 1, P.G); }
  } else {
    rect(ctx, 0, floorY, w, h - floorY, "#f5b98c"); // 원래 나무 바닥 색
    ctx.fillStyle = "#e9a274"; for (let y = floorY + 8; y < h; y += 10) ctx.fillRect(0, y, w, 1);
  }
}

// ---------- 러그 ----------
const RUG = { rug_pink: [P.P, P.p], rug_star: [P.B, "#3d4f9a"], rug_green: [P.G, P.g], rug_purple: [P.V, P.v] };
export function drawRug(ctx, cx, rugY, w, id = "rug_pink") {
  if (drawRugRoom(ctx, cx, rugY, w, id)) return;
  const R1 = Math.min(40, w * 0.3), R2 = Math.min(32, w * 0.24);
  if (id === "rug_rainbow") {
    const cols = [P.r, P.o, P.y, P.g, P.b, P.v];
    cols.forEach((c, i) => { const k = 1 - i / cols.length; for (let j = -6; j <= 6; j++) { const half = Math.round(Math.sqrt(Math.max(0, 1 - (j / 7) ** 2)) * R1 * k); if (Math.abs(j) <= 6 * k + 0.5) rect(ctx, cx - half, rugY + j, half * 2, 1, c); } });
    return;
  }
  const [a, b] = RUG[id] || RUG.rug_pink;
  for (let i = -6; i <= 6; i++) { const half = Math.round(Math.sqrt(1 - (i / 7) ** 2) * R1); rect(ctx, cx - half, rugY + i, half * 2, 1, a); }
  for (let i = -4; i <= 4; i++) { const half = Math.round(Math.sqrt(1 - (i / 5) ** 2) * R2); rect(ctx, cx - half, rugY + i, half * 2, 1, b); }
  if (id === "rug_star") {
    for (const [sx, sy] of [[-24, -2], [-12, 2], [-2, -3], [9, 1], [20, -2], [28, 2], [-30, 1], [2, 3]]) { rect(ctx, cx + sx, rugY + sy, 1, 1, P.y); if ((sx + sy) % 2 === 0) { rect(ctx, cx + sx - 1, rugY + sy, 3, 1, P.y); rect(ctx, cx + sx, rugY + sy - 1, 1, 3, P.y); } }
    rect(ctx, cx + 14, rugY - 3, 2, 2, P.w);
  } else if (id === "rug_green") {
    for (const sx of [-20, -6, 8, 22]) { rect(ctx, cx + sx, rugY - 1, 3, 1, P.G); rect(ctx, cx + sx + 1, rugY, 1, 1, P.G); }
  } else if (id === "rug_purple") {
    for (const sx of [-18, 0, 18]) { rect(ctx, cx + sx, rugY, 1, 1, P.w); rect(ctx, cx + sx - 1, rugY - 1, 1, 1, P.w); rect(ctx, cx + sx + 1, rugY - 1, 1, 1, P.w); }
  }
}

// ---------- 창문 커튼(창틀 바깥 양옆 + 위 주름 장식) ----------
export function drawCurtain(ctx, r, id) {
  if (!id) return;
  const [c1, c2] = CURTAIN_COLORS[id] || (id === "curtain_lace" ? [P.w, "#efe2d4"] : id === "curtain_star" ? [P.B, "#3d4f9a"] : [P.p, P.P]);
  const pw = Math.max(7, Math.round(r.w * 0.18)); // 펼쳤을 때 폭
  const y0 = r.y - 3, y1 = r.y + r.h + 6, tie = 0.58; // 끈으로 묶는 높이(위에서 58%)
  for (const side of [-1, 1]) {
    // 바깥 끝은 고정, 안쪽 끝만 끈 쪽으로 오므라졌다가 아래로 다시 퍼짐(좌우 대칭)
    const outer = side < 0 ? r.x - 4 : r.x + r.w + 4; // 왼쪽은 이 x부터 오른쪽으로, 오른쪽은 이 x까지
    for (let y = y0; y < y1; y++) {
      const t = (y - y0) / (y1 - y0);
      const pinch = t < tie ? Math.sin((t / tie) * Math.PI / 2) : 1 - ((t - tie) / (1 - tie)) * 0.55; // 0 → 1(묶은 곳) → 0.45
      const wdt = Math.max(3, Math.round(pw * (1 - 0.55 * pinch)));
      const x = side < 0 ? outer : outer - wdt;
      rect(ctx, x, y, wdt, 1, c1);
      for (let fx = 2; fx < wdt - 1; fx += 3) rect(ctx, side < 0 ? x + fx : x + wdt - 1 - fx, y, 1, 1, c2); // 주름(바깥에서 안쪽으로)
      rect(ctx, side < 0 ? x + wdt - 1 : x, y, 1, 1, c2); // 안쪽 가장자리 그늘
    }
    // 묶은 끈
    const ty = Math.round(y0 + (y1 - y0) * tie), tw = Math.max(3, Math.round(pw * 0.45)) + 1;
    rect(ctx, side < 0 ? outer - 1 : outer - tw, ty - 1, tw + 1, 3, P.k); rect(ctx, side < 0 ? outer : outer - tw + 1, ty, tw - 1, 1, P.y);
    if (id === "curtain_star") for (let y = r.y + 1; y < r.y + r.h; y += 5) rect(ctx, side < 0 ? outer + 1 : outer - 2, y + (side > 0 ? 2 : 0), 1, 1, P.y);
    if (id === "curtain_lace") for (let fx = 0; fx < pw - 2; fx += 2) rect(ctx, side < 0 ? outer + fx : outer - 1 - fx, y1, 1, 1, P.s); // 레이스 끝단
  }
  if (CURTAIN_COLORS[id]) drawCurtainExtra(ctx, r, id);
  rect(ctx, r.x - 6, r.y - 6, r.w + 12, 4, c2); // 위 장식(봉)
  for (let x = r.x - 6; x < r.x + r.w + 6; x += 4) rect(ctx, x, r.y - 2, 2, 2, c1);
}

// ---------- 가구 ----------
// opts: { now, dark(0~1) }
// 가구 가로 반폭(화면 끝에서 안 잘리게 자리 잡을 때 씀)
export const FURN_HALF = { sofa: 28, cloudbed: 18, shelf: 12, lamp: 9, plant: 10, fishbowl: 11, radio: 10, ...FURN_HALF_ROOM };
export function drawFurniture(ctx, id, x, base, { now = 0, dark = 0, front = false } = {}) {
  if (drawFurnRoom(ctx, id, x, base, { now, dark, front })) return;
  const k = P.k;
  if (id === "lamp") {
    rect(ctx, x - 5, base - 2, 10, 2, k); rect(ctx, x - 1, base - 22, 2, 20, P.N);
    rect(ctx, x - 8, base - 30, 16, 9, k); rect(ctx, x - 7, base - 29, 14, 7, dark > 0.25 ? "#fff3b0" : P.y); rect(ctx, x - 5, base - 28, 4, 1, P.w);
  } else if (id === "plant") {
    rect(ctx, x - 6, base - 9, 12, 9, k); rect(ctx, x - 5, base - 8, 10, 7, P.o); rect(ctx, x - 5, base - 8, 10, 2, P.O);
    const sway = Math.round(Math.sin(now / 900) * 1);
    for (const [dx, dy, s] of [[-6, -18, 1], [3, -22, -1], [-2, -27, 1], [6, -15, -1]]) { rect(ctx, x + dx + sway - 1, base + dy - 1, 8, 6, k); rect(ctx, x + dx + sway, base + dy, 6, 4, P.G); rect(ctx, x + dx + sway + 1, base + dy + 1, 2, 1, P.g); }
    rect(ctx, x, base - 18, 1, 9, P.G);
  } else if (id === "shelf") {
    rect(ctx, x - 11, base - 32, 22, 32, k); rect(ctx, x - 10, base - 31, 20, 30, P.n);
    for (const sy of [-21, -11]) rect(ctx, x - 10, base + sy, 20, 2, P.N);
    const books = [P.p, P.b, P.y, P.g, P.v, P.r];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++) rect(ctx, x - 9 + i * 4, base - 30 + row * 10, 3, 8 - (i % 2), books[(i + row) % books.length]);
  } else if (id === "sofa") { // 펫이 앉을 만큼 넓은 소파(가로 약 54)
    if (!front) {
      rect(ctx, x - 22, base - 27, 44, 15, k); rect(ctx, x - 21, base - 26, 42, 13, P.p); // 등받이
      for (const bx of [-13, 0, 13]) rect(ctx, x + bx - 1, base - 24, 2, 9, P.P); // 등받이 단추 줄
      rect(ctx, x - 25, base - 15, 50, 4, k); rect(ctx, x - 24, base - 14, 48, 3, "#ffc2cf"); // 좌석 윗면
    }
    rect(ctx, x - 25, base - 12, 50, 10, k); rect(ctx, x - 24, base - 11, 48, 8, P.P); rect(ctx, x - 22, base - 10, 10, 1, P.p); // 좌석 앞면
    rect(ctx, x - 28, base - 19, 7, 17, k); rect(ctx, x - 27, base - 18, 5, 15, P.p); rect(ctx, x + 21, base - 19, 7, 17, k); rect(ctx, x + 22, base - 18, 5, 15, P.p); // 팔걸이
    rect(ctx, x - 26, base - 2, 3, 2, P.N); rect(ctx, x + 23, base - 2, 3, 2, P.N);
  } else if (id === "fishbowl") {
    rect(ctx, x - 7, base - 8, 14, 8, k); rect(ctx, x - 6, base - 7, 12, 6, P.n);
    ellipse(ctx, x, base - 17, 10, 9, k); ellipse(ctx, x, base - 17, 9, 8, "#cfeaff"); rect(ctx, x - 9, base - 17, 18, 7, P.b); rect(ctx, x - 6, base - 23, 3, 2, P.w);
    const fx = Math.round(x + Math.sin(now / 700) * 5), dir = Math.cos(now / 700) >= 0 ? 1 : -1;
    rect(ctx, fx - 2, base - 15, 4, 3, P.o); rect(ctx, fx - 2 - 2 * dir + (dir > 0 ? 0 : 4), base - 15, 2, 3, P.O); rect(ctx, fx + dir, base - 14, 1, 1, k);
    if (Math.floor(now / 600) % 3 === 0) rect(ctx, fx + 2 * dir, base - 20 - (Math.floor(now / 200) % 3), 1, 1, P.w);
  } else if (id === "radio") {
    rect(ctx, x - 4, base - 4, 2, 4, k); rect(ctx, x + 2, base - 4, 2, 4, k); // 작은 탁자 다리
    rect(ctx, x - 9, base - 6, 18, 2, P.N);
    rect(ctx, x - 9, base - 19, 18, 13, k); rect(ctx, x - 8, base - 18, 16, 11, P.y);
    ellipse(ctx, x - 3, base - 12, 3, 3, P.O); rect(ctx, x + 3, base - 16, 3, 7, P.w); rect(ctx, x + 4, base - 15, 1, 5, P.N);
    rect(ctx, x + 5, base - 25, 1, 6, k); rect(ctx, x - 7, base - 18, 2, 2, P.p);
    for (let i = 0; i < 2; i++) { const ph = ((now / 1400) + i / 2) % 1; ctx.globalAlpha = Math.sin(ph * Math.PI); ctx.fillStyle = k; ctx.font = "bold 7px system-ui"; ctx.textAlign = "center"; ctx.fillText(i ? "♫" : "♪", x - 4 + i * 8 + Math.sin(ph * 6) * 2, base - 22 - ph * 12); ctx.globalAlpha = 1; }
  } else if (id === "cloudbed") {
    rect(ctx, x - 16, base - 4, 4, 4, P.N); rect(ctx, x + 12, base - 4, 4, 4, P.N);
    for (const [dx, dy, rr] of [[-10, -9, 6], [0, -11, 7], [10, -9, 6]]) ellipse(ctx, x + dx, base + dy, rr + 1, rr, k);
    rect(ctx, x - 17, base - 10, 34, 7, k);
    for (const [dx, dy, rr] of [[-10, -9, 5], [0, -11, 6], [10, -9, 5]]) ellipse(ctx, x + dx, base + dy, rr, rr - 1, P.w);
    rect(ctx, x - 16, base - 9, 32, 5, P.w); rect(ctx, x - 16, base - 5, 32, 1, "#dfe8f7"); rect(ctx, x - 8, base - 13, 4, 2, "#ffe0ea");
  }
}

// ---------- 작은 칸(2026-10-09): 창가·벽걸이·바닥 소품. x = 가운데, base = 닿는 y(벽걸이는 가운데 y) ----------
// opts: { now(움직임), wall(실제 시각, 벽시계), dark }
export function drawSmall(ctx, id, x, base, { now = 0, wall = Date.now(), dark = 0, days = 0 } = {}) {
  if (drawSmallRoom(ctx, id, x, base, { now, wall, dark, days })) return;
  const k = P.k;
  if (id === "sill_cactus") {
    rect(ctx, x - 4, base - 5, 8, 5, k); rect(ctx, x - 3, base - 4, 6, 3, P.o); rect(ctx, x - 3, base - 4, 6, 1, P.O);
    rect(ctx, x - 2, base - 13, 4, 8, k); rect(ctx, x - 1, base - 12, 2, 7, P.G);
    rect(ctx, x - 5, base - 11, 3, 4, k); rect(ctx, x - 4, base - 10, 1, 2, P.G); rect(ctx, x + 2, base - 12, 3, 4, k); rect(ctx, x + 3, base - 11, 1, 2, P.G);
    rect(ctx, x, base - 14, 1, 1, P.p);
  } else if (id === "sill_cat") {
    const wag = Math.floor(now / 500) % 4 === 0 ? -1 : 0;
    rect(ctx, x + 4, base - 6 + wag, 3, 2, k); rect(ctx, x + 6, base - 9 + wag, 2, 4, k); // 꼬리
    rect(ctx, x - 5, base - 7, 10, 7, k); rect(ctx, x - 4, base - 6, 8, 5, P.w); // 몸
    rect(ctx, x - 4, base - 13, 8, 7, k); rect(ctx, x - 3, base - 12, 6, 5, P.w); // 머리
    rect(ctx, x - 4, base - 15, 2, 2, k); rect(ctx, x + 2, base - 15, 2, 2, k); // 귀
    rect(ctx, x - 2, base - 10, 1, 1, k); rect(ctx, x + 1, base - 10, 1, 1, k); rect(ctx, x - 3, base - 9, 1, 1, P.p); rect(ctx, x + 2, base - 9, 1, 1, P.p);
    rect(ctx, x - 1, base - 4, 2, 2, P.o);
  } else if (id === "sill_jar") {
    rect(ctx, x - 4, base - 11, 8, 11, k); rect(ctx, x - 3, base - 10, 6, 9, "#cfeaff"); rect(ctx, x - 3, base - 13, 6, 3, k); rect(ctx, x - 2, base - 12, 4, 1, P.N);
    const tw = Math.floor(now / 400);
    for (const [dx, dy, i] of [[-2, -3, 0], [1, -5, 1], [-1, -8, 2], [2, -2, 3]]) rect(ctx, x + dx, base + dy, 1, 1, (tw + i) % 3 === 0 || dark > 0.25 ? P.y : P.Y);
    rect(ctx, x - 3, base - 10, 1, 4, P.w);
  } else if (id === "wall_clock") {
    const cy = base;
    ellipse(ctx, x, cy, 8, 8, k); ellipse(ctx, x, cy, 7, 7, P.w); ellipse(ctx, x, cy, 6, 6, "#fffaf2");
    for (const [dx, dy] of [[0, -5], [5, 0], [0, 5], [-5, 0]]) rect(ctx, x + dx, cy + dy, 1, 1, k);
    const d = new Date(wall), hh = (d.getHours() % 12) + d.getMinutes() / 60, mm = d.getMinutes();
    const hand = (ang, len, c) => { for (let i = 1; i <= len; i++) rect(ctx, x + Math.round(Math.sin(ang) * i), cy - Math.round(Math.cos(ang) * i), 1, 1, c); };
    hand((hh / 12) * Math.PI * 2, 3, k); hand((mm / 60) * Math.PI * 2, 5, P.r);
    rect(ctx, x, cy, 1, 1, k); rect(ctx, x - 1, cy - 10, 3, 2, P.p);
  } else if (id === "wall_shelf") {
    const y = base + 4;
    rect(ctx, x - 11, y, 22, 3, k); rect(ctx, x - 10, y + 1, 20, 1, P.n);
    rect(ctx, x - 9, y + 3, 2, 3, k); rect(ctx, x + 7, y + 3, 2, 3, k);
    rect(ctx, x - 8, y - 5, 5, 5, k); rect(ctx, x - 7, y - 4, 3, 3, P.v); // 작은 화분
    rect(ctx, x - 7, y - 8, 1, 3, P.G); rect(ctx, x - 5, y - 9, 1, 4, P.G); rect(ctx, x - 6, y - 10, 1, 1, P.p); rect(ctx, x - 4, y - 10, 1, 1, P.y);
    rect(ctx, x + 1, y - 7, 3, 7, k); rect(ctx, x + 2, y - 6, 1, 5, P.b); rect(ctx, x + 4, y - 6, 3, 6, k); rect(ctx, x + 5, y - 5, 1, 4, P.y); // 책
  } else if (id === "wall_garland") {
    const cols = [P.p, P.y, P.b, P.g, P.v];
    for (let i = -12; i <= 12; i++) rect(ctx, x + i, base - 6 + Math.round((i * i) / 30), 1, 1, k);
    cols.forEach((c, n) => { const fx = x - 10 + n * 5, fy = base - 5 + Math.round(((fx - x) ** 2) / 30); rect(ctx, fx - 2, fy, 5, 2, c); rect(ctx, fx - 1, fy + 2, 3, 2, c); rect(ctx, fx, fy + 4, 1, 1, c); });
  } else if (id === "prop_ball") {
    const b = Math.abs(Math.round(Math.sin(now / 600) * 1));
    ellipse(ctx, x, base - 5 - b, 5, 5, k); ellipse(ctx, x, base - 5 - b, 4, 4, P.r);
    rect(ctx, x - 4, base - 6 - b, 9, 2, P.y); rect(ctx, x - 1, base - 9 - b, 2, 8, P.b); rect(ctx, x - 2, base - 8 - b, 1, 1, P.w);
  } else if (id === "prop_bear") {
    ellipse(ctx, x, base - 5, 6, 5, k); ellipse(ctx, x, base - 5, 5, 4, P.N); ellipse(ctx, x, base - 4, 2, 2, P.n); // 몸
    ellipse(ctx, x, base - 13, 5, 4, k); ellipse(ctx, x, base - 13, 4, 3, P.N); // 머리
    rect(ctx, x - 5, base - 18, 3, 3, k); rect(ctx, x + 3, base - 18, 3, 3, k); rect(ctx, x - 4, base - 17, 1, 1, P.n); rect(ctx, x + 4, base - 17, 1, 1, P.n);
    rect(ctx, x - 2, base - 14, 1, 1, k); rect(ctx, x + 2, base - 14, 1, 1, k); rect(ctx, x - 1, base - 12, 3, 2, P.n); rect(ctx, x, base - 12, 1, 1, k);
    rect(ctx, x - 1, base - 9, 3, 1, P.r);
  } else if (id === "prop_train") {
    rect(ctx, x - 8, base - 9, 16, 6, k); rect(ctx, x - 7, base - 8, 14, 4, P.r); rect(ctx, x + 1, base - 13, 7, 5, k); rect(ctx, x + 2, base - 12, 5, 3, P.b); // 몸·칸
    rect(ctx, x - 6, base - 12, 3, 3, k); rect(ctx, x - 7, base - 13, 5, 1, k); // 굴뚝
    for (const wx of [-5, 0, 5]) { rect(ctx, x + wx - 2, base - 4, 4, 4, k); rect(ctx, x + wx - 1, base - 3, 2, 2, P.N); }
    const ph = (now / 900) % 1; ctx.globalAlpha = 1 - ph; ellipse(ctx, x - 5 - Math.round(ph * 3), base - 15 - Math.round(ph * 6), 2, 2, P.w); ctx.globalAlpha = 1;
  }
}

// ---------- 놀이방 기구(2026-10-09). x = 가운데, base = 바닥 ----------
// 같이 놀기 장면(app/playshow.js)용: sw = 그네 흔들림(도트), dip = 트램펄린 눌림, shake = 블록 흔들림
export function drawPlay(ctx, id, x, base, { now = 0, sw: swing = null, dip = null, shake = 0 } = {}) {
  const k = P.k;
  if (id === "play_slide") {
    rect(ctx, x - 14, base - 30, 3, 30, k); rect(ctx, x - 8, base - 30, 3, 30, k); // 사다리
    for (let y = base - 26; y < base; y += 6) rect(ctx, x - 13, y, 7, 2, P.y);
    rect(ctx, x - 13, base - 29, 1, 29, P.y); rect(ctx, x - 7, base - 29, 1, 29, P.y);
    rect(ctx, x - 15, base - 33, 12, 4, k); rect(ctx, x - 14, base - 32, 10, 2, P.r); // 꼭대기
    for (let i = 0; i < 24; i++) { const sx = x - 4 + i, sy = base - 31 + Math.round(i * 1.15); rect(ctx, sx, sy - 1, 1, 5, k); rect(ctx, sx, sy, 1, 3, P.b); } // 미끄럼
    rect(ctx, x + 18, base - 4, 3, 4, k);
  } else if (id === "play_tent") {
    for (let i = 0; i <= 26; i++) { const hw = Math.round(i * 0.62); rect(ctx, x - hw - 1, base - 26 + i, hw * 2 + 2, 1, k); if (i > 0) rect(ctx, x - hw, base - 26 + i, hw * 2, 1, i % 6 < 3 ? P.p : P.w); }
    for (let i = 8; i <= 26; i++) { const hw = Math.round((i - 8) * 0.3); rect(ctx, x - hw, base - 26 + i, hw * 2 + 1, 1, "#7a4a3a"); }
    rect(ctx, x, base - 31, 1, 6, k); rect(ctx, x + 1, base - 31, 4, 3, P.y);
  } else if (id === "play_pool") {
    rect(ctx, x - 18, base - 14, 36, 14, k); rect(ctx, x - 17, base - 13, 34, 12, P.b); rect(ctx, x - 17, base - 13, 34, 2, "#cfeaff");
    const cols = [P.r, P.y, P.g, P.p, P.v, P.o];
    for (let i = 0; i < 14; i++) { const bx = x - 15 + ((i * 7) % 31), by = base - 17 + ((i * 5) % 4); rect(ctx, bx - 1, by - 1, 4, 4, k); rect(ctx, bx, by, 2, 2, cols[i % cols.length]); }
  } else if (id === "play_blocks") {
    const B = [[-12, 0, P.r], [-2, 0, P.b], [8, 0, P.y], [-7, -9, P.g], [3, -9, P.p], [-2, -18, P.v]];
    for (const [dx0, dy, c] of B) { const dx = dx0 + (shake ? Math.round(Math.sin(now / 60 + dy) * shake) : 0); rect(ctx, x + dx - 4, base + dy - 9, 10, 9, k); rect(ctx, x + dx - 3, base + dy - 8, 8, 7, c); rect(ctx, x + dx - 3, base + dy - 8, 8, 1, P.w); }
  } else if (id === "play_tramp") {
    const b = dip ?? Math.abs(Math.round(Math.sin(now / 350) * 2));
    for (const lx of [-13, -5, 5, 13]) rect(ctx, x + lx, base - 7, 2, 7, k);
    ellipse(ctx, x, base - 9 + Math.min(1, b), 17, 4, k); ellipse(ctx, x, base - 9 + Math.min(1, b), 16, 3, P.v); ellipse(ctx, x, base - 9 + Math.min(1, b), 12, 2, "#3d4f9a");
    if (b > 1) { rect(ctx, x - 4, base - 18, 1, 2, P.w); rect(ctx, x + 4, base - 17, 1, 2, P.w); }
  } else if (id === "play_swing") {
    rect(ctx, x - 16, base - 34, 32, 3, k); rect(ctx, x - 15, base - 33, 30, 1, P.N);
    for (let i = 0; i < 34; i++) { rect(ctx, x - 16 - Math.round(i * 0.12), base - 34 + i, 2, 1, k); rect(ctx, x + 14 + Math.round(i * 0.12), base - 34 + i, 2, 1, k); }
    const sw = swing ?? Math.round(Math.sin(now / 700) * 4);
    for (let i = 0; i < 20; i++) { const t = i / 20; rect(ctx, x - 5 + Math.round(sw * t), base - 31 + i, 1, 1, P.N); rect(ctx, x + 5 + Math.round(sw * t), base - 31 + i, 1, 1, P.N); }
    rect(ctx, x - 7 + sw, base - 12, 15, 3, k); rect(ctx, x - 6 + sw, base - 11, 13, 1, P.r);
  }
}

// 밤에 불을 끄면 스탠드가 은은하게(어둠 위에 덧그림)
export function drawLampGlow(ctx, x, base, dark) {
  if (dark < 0.25) return;
  const a = Math.min(0.35, dark * 0.5);
  for (let r = 26; r > 4; r -= 4) { ctx.fillStyle = `rgba(255,226,140,${a * (1 - r / 30)})`; ellipse(ctx, x, base - 26, r, Math.round(r * 0.8), ctx.fillStyle); }
  rect(ctx, x - 7, base - 29, 14, 7, "#fff3b0"); rect(ctx, x - 5, base - 28, 4, 1, P.w);
}

// ---------- 상점·꾸미기용 작은 그림 ----------
export function drawThumb(canvas, item, now = 0) {
  const ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!item) return;
  if (item.slot === "wall") { drawWall(ctx, W, H, item.id); rect(ctx, 0, H - 3, W, 3, "#e9b48a"); }
  else if (item.slot === "floor") { rect(ctx, 0, 0, W, 6, P.c); drawFloor(ctx, W, H, 6, item.id); }
  else if (item.slot === "rug") drawRug(ctx, W / 2, H / 2, W * 1.15, item.id);
  else if (item.slot === "curtain") { const r = { x: Math.round(W * 0.3), y: Math.round(H * 0.25), w: Math.round(W * 0.4), h: Math.round(H * 0.5) }; rect(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, P.N); rect(ctx, r.x, r.y, r.w, r.h, P.b); drawCurtain(ctx, r, item.id); }
  else if (item.slot === "furnL" || item.slot === "furnR") drawFurniture(ctx, item.id, W / 2, H - 2, { now });
  else if (item.slot === "sill" || item.slot === "prop") { ctx.save(); ctx.translate(W / 2, H - 3); ctx.scale(2, 2); drawSmall(ctx, item.id, 0, 0, { now }); ctx.restore(); } // 작은 소품은 2배로
  else if (item.slot === "wallR") { rect(ctx, 0, 0, W, H, P.c); ctx.save(); ctx.translate(W / 2, Math.round(H / 2)); ctx.scale(2, 2); drawSmall(ctx, item.id, 0, 0, { now }); ctx.restore(); }
  else if (item.slot === "playL" || item.slot === "playM" || item.slot === "playR") { ctx.save(); const sc = Math.min(1, (H - 2) / 36); ctx.translate(W / 2, H - 2); ctx.scale(sc, sc); drawPlay(ctx, item.id, 0, 0, { now }); ctx.restore(); }
  else if (item.slot === "hat") { const sp = SPRITES[HAT_SPRITE[item.id]]; if (sp) { const { w: sw, h: sh } = spriteSize(sp); const sc = Math.max(1, Math.floor(Math.min(W / sw, H / sh) * 0.7)); drawSprite(ctx, sp, Math.round((W - sw * sc) / 2), Math.round((H - sh * sc) / 2), sc); } }
}
