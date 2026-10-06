// 방 꾸미기 그림: 벽지·바닥·러그·커튼·가구. 상점 미리보기(작은 그림)도 같은 함수로 그린다.
// 좌표는 캔버스 논리 픽셀. 가구는 x(가운데)·base(바닥에 닿는 y) 기준.
import { PALETTE } from "./palette.js?v=1e8b618-1791275895";
import { SPRITES, drawSprite, spriteSize } from "./sprites.js?v=1e8b618-1791275895";

export const HAT_SPRITE = { hat_ribbon: "hatRibbon", hat_straw: "hatStraw", hat_glasses: "hatGlasses", hat_crown: "hatCrown", hat_flower: "hatFlower" };

const P = PALETTE;
const rect = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const ellipse = (ctx, cx, cy, rx, ry, c) => { for (let i = -ry; i <= ry; i++) { const hw = Math.round(Math.sqrt(Math.max(0, 1 - (i / ry) ** 2)) * rx); rect(ctx, cx - hw, cy + i, hw * 2, 1, c); } };

// ---------- 벽지 ----------
export const WALL_BASE = { wall_basic: P.c, wall_berry: "#ffe6ee", wall_cloud: "#dceeff", wall_night: "#3d4f9a", wall_leaf: "#e2f4dc" };
export function drawWall(ctx, w, floorY, id = "wall_basic") {
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
  const [c1, c2] = id === "curtain_lace" ? [P.w, "#efe2d4"] : id === "curtain_star" ? [P.B, "#3d4f9a"] : [P.p, P.P];
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
  rect(ctx, r.x - 6, r.y - 6, r.w + 12, 4, c2); // 위 장식(봉)
  for (let x = r.x - 6; x < r.x + r.w + 6; x += 4) rect(ctx, x, r.y - 2, 2, 2, c1);
}

// ---------- 가구 ----------
// opts: { now, dark(0~1) }
// 가구 가로 반폭(화면 끝에서 안 잘리게 자리 잡을 때 씀)
export const FURN_HALF = { sofa: 28, cloudbed: 18, shelf: 12, lamp: 9, plant: 10, fishbowl: 11, radio: 10 };
export function drawFurniture(ctx, id, x, base, { now = 0, dark = 0, front = false } = {}) {
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
  else if (item.slot === "hat") { const sp = SPRITES[HAT_SPRITE[item.id]]; if (sp) { const { w: sw, h: sh } = spriteSize(sp); const sc = Math.max(1, Math.floor(Math.min(W / sw, H / sh) * 0.7)); drawSprite(ctx, sp, Math.round((W - sw * sc) / 2), Math.round((H - sh * sc) / 2), sc); } }
}
