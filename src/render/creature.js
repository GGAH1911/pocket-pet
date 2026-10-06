// 캐릭터 그리기: 부위 조합 도트.
// 몸 모양(타원·물방울·구름) + 귀·뿔·날개·꼬리·발·무늬를 도트 격자(칸)에 칠하고,
// 바깥 테두리와 그림자를 자동으로 입힌다. 자세(늘어남·찌그러짐·바라보는 방향)는 매 프레임 반영된다.
// 얼굴(표정)은 face.js 가 이 격자 위에 따로 얹는다.
import { PALETTE } from "./palette.js?v=f0c1ae9-1791249907";

const GW = 76, GH = 50; // 격자 크기(칸): 가장 큰 형태가 통통+늘어남이어도 안 잘리게

// ---------- 격자와 도형 ----------
function grid() { return { w: GW, h: GH, c: new Array(GW * GH).fill(null) }; }
function put(g, x, y, col, onlyEmpty = false) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  const i = y * g.w + x;
  if (onlyEmpty && g.c[i]) return;
  g.c[i] = col;
}
function get(g, x, y) { return x < 0 || y < 0 || x >= g.w || y >= g.h ? null : g.c[y * g.w + x]; }

function ellipse(g, cx, cy, rx, ry, col, { onlyEmpty = false, shade = null, shadeFrom = 0.45 } = {}) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) put(g, x, y, shade && dy > shadeFrom ? shade : col, onlyEmpty);
    }
  }
}
function tri(g, a, b, c, col, onlyEmpty = false) {
  const minX = Math.floor(Math.min(a[0], b[0], c[0])), maxX = Math.ceil(Math.max(a[0], b[0], c[0]));
  const minY = Math.floor(Math.min(a[1], b[1], c[1])), maxY = Math.ceil(Math.max(a[1], b[1], c[1]));
  const area = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const A = area(a, b, c);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const p = [x + 0.5, y + 0.5];
    const w0 = area(b, c, p) / A, w1 = area(c, a, p) / A, w2 = area(a, b, p) / A;
    if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) put(g, x, y, col, onlyEmpty);
  }
}
function rect(g, x, y, w, h, col, onlyEmpty = false) {
  for (let yy = Math.round(y); yy < Math.round(y + h); yy++) for (let xx = Math.round(x); xx < Math.round(x + w); xx++) put(g, xx, yy, col, onlyEmpty);
}
// 물방울(슬라임): 아래는 타원, 위로 갈수록 뾰족
function drop(g, cx, cy, rx, ry, col, shade) {
  for (let y = Math.floor(cy - ry * 1.7); y <= Math.ceil(cy + ry); y++) {
    const ny = (y + 0.5 - cy) / ry;
    let half;
    if (ny >= -0.2) half = rx * Math.sqrt(Math.max(0, 1 - ny * ny));
    else half = rx * Math.sqrt(1 - 0.04) * Math.max(0, (ny + 1.7) / 1.5) ** 1.3;
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      if (Math.abs(x + 0.5 - cx) <= half) put(g, x, y, shade && ny > 0.45 ? shade : col);
    }
  }
}
// 구름: 큰 타원 + 위쪽 혹 3개
function cloud(g, cx, cy, rx, ry, col, shade, spiky = false) {
  ellipse(g, cx, cy + ry * 0.15, rx, ry * 0.8, col, { shade, shadeFrom: 0.4 });
  ellipse(g, cx - rx * 0.45, cy - ry * 0.25, rx * 0.45, ry * 0.6, col);
  ellipse(g, cx + rx * 0.05, cy - ry * 0.45, rx * 0.5, ry * 0.65, col);
  ellipse(g, cx + rx * 0.5, cy - ry * 0.15, rx * 0.4, ry * 0.5, col);
  if (spiky) for (const k of [-0.6, -0.15, 0.35, 0.75]) tri(g, [cx + rx * k - 2, cy - ry * 0.35], [cx + rx * k + 2, cy - ry * 0.35], [cx + rx * k + 0.5, cy - ry * 1.15], col);
}

// ---------- 테두리·그림자 ----------
function outline(g) {
  const out = g.c.slice();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.c[y * g.w + x]) continue;
    if (get(g, x - 1, y) || get(g, x + 1, y) || get(g, x, y - 1) || get(g, x, y + 1)) out[y * g.w + x] = "k";
  }
  g.c = out;
}

// ---------- 형태 정의 ----------
// 각 형태: { size:[rx, ry], draw(g, P) } P: { cx, cy, rx, ry, base, f(방향), spot(알 무늬 색), messy }
// 좌표는 칸 단위. f = 1(오른쪽 봄) | -1(왼쪽 봄). 꼬리는 바라보는 반대쪽.
const X = (P, dx) => P.cx + dx * P.f;

function feet(g, P, col, spread = 0.5, size = 2.2) {
  ellipse(g, X(P, -P.rx * spread), P.base - 1, size, 1.6, col, { onlyEmpty: true });
  ellipse(g, X(P, P.rx * spread), P.base - 1, size, 1.6, col, { onlyEmpty: true });
}
function messyTufts(g, P, col) {
  if (!P.messy) return;
  for (const k of [-0.45, 0, 0.45]) tri(g, [X(P, P.rx * k) - 1.5, P.cy - P.ry * 0.85], [X(P, P.rx * k) + 1.5, P.cy - P.ry * 0.85], [X(P, P.rx * k + 0.8), P.cy - P.ry * 1.35], col);
}
function highlight(g, P) {
  put(g, P.cx - P.rx * 0.5, P.cy - P.ry * 0.55, "w"); put(g, P.cx - P.rx * 0.5 + 1, P.cy - P.ry * 0.62, "w");
}

export const FORMS = {
  // ===== 동물 =====
  "animal.baby": { name: "털뭉치", size: [7.5, 7], draw(g, P) {
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "w", { shade: "S" });
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; put(g, P.cx + Math.cos(a) * (P.rx + 0.6), P.cy + Math.sin(a) * (P.ry + 0.6), i % 3 ? "w" : "S"); } // 솜털
    ellipse(g, X(P, -P.rx * 0.55), P.cy - P.ry * 0.95, 1.6, 1.4, "w"); ellipse(g, X(P, P.rx * 0.55), P.cy - P.ry * 0.95, 1.6, 1.4, "w"); // 귀 혹
    put(g, P.cx, P.cy - P.ry - 1, P.spot); put(g, P.cx + 1, P.cy - P.ry - 1, P.spot); // 머리 위 알 무늬 한 점
    messyTufts(g, P, "w");
  } },
  "animal.child": { name: "아기 강아지", size: [9.5, 8], draw(g, P) {
    ellipse(g, X(P, -P.rx * 0.95), P.cy + P.ry * 0.3, 2.2, 1.6, "w"); // 작은 꼬리
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "w", { shade: "S" });
    feet(g, P, "S", 0.45, 2);
    // 늘어진 귀(갈색), 한쪽 귀에 알 무늬 색
    ellipse(g, X(P, -P.rx * 0.98), P.cy - P.ry * 0.3, 1.9, P.ry * 0.55, "n");
    ellipse(g, X(P, P.rx * 0.98), P.cy - P.ry * 0.3, 1.9, P.ry * 0.55, "n");
    ellipse(g, X(P, P.rx * 0.98), P.cy - P.ry * 0.1, 1, P.ry * 0.22, P.spot);
    messyTufts(g, P, "w");
  } },
  "animal.teen.good": { name: "꼬마 강아지", size: [10, 8.5], draw(g, P) {
    // 말린 꼬리
    ellipse(g, X(P, -P.rx * 1.0), P.cy - P.ry * 0.25, 2.6, 2.6, "o"); ellipse(g, X(P, -P.rx * 1.0), P.cy - P.ry * 0.25, 1, 1, "w");
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "o", { shade: "O" });
    ellipse(g, P.cx, P.cy + P.ry * 0.35, P.rx * 0.6, P.ry * 0.55, "w"); // 배
    feet(g, P, "O", 0.5);
    // 반쯤 선 귀: 위로 솟다가 끝이 꺾임
    for (const s of [-1, 1]) {
      tri(g, [X(P, s * P.rx * 0.75) - 2, P.cy - P.ry * 0.6], [X(P, s * P.rx * 0.75) + 2, P.cy - P.ry * 0.6], [X(P, s * P.rx * 0.8), P.cy - P.ry * 1.25], "o");
      put(g, X(P, s * P.rx * 0.8) + s * P.f, P.cy - P.ry * 1.15, P.spot);
    }
    messyTufts(g, P, "o");
  } },
  "animal.teen.normal": { name: "꼬마 고양이", size: [9.5, 8.5], draw(g, P) {
    // 긴 꼬리(위로 휘어짐)
    for (let i = 0; i < 9; i++) put(g, X(P, -P.rx * 0.9 - i * 0.55), P.cy + P.ry * 0.4 - i * 0.9 + (i > 6 ? (i - 6) * 0.6 : 0), "W"), put(g, X(P, -P.rx * 0.9 - i * 0.55) + 1, P.cy + P.ry * 0.4 - i * 0.9, "W");
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "W", { shade: "L" });
    // 줄무늬
    for (const k of [-0.3, 0, 0.3]) rect(g, P.cx + P.rx * k - 0.5, P.cy - P.ry * 0.95, 1, 2, "L");
    feet(g, P, "L", 0.45, 2);
    for (const s of [-1, 1]) { // 뾰족 귀 + 안쪽 알 무늬 색
      tri(g, [X(P, s * P.rx * 0.35), P.cy - P.ry * 0.75], [X(P, s * P.rx * 0.95), P.cy - P.ry * 0.5], [X(P, s * P.rx * 0.8), P.cy - P.ry * 1.45], "W");
      put(g, X(P, s * P.rx * 0.75), P.cy - P.ry * 0.95, P.spot);
    }
    messyTufts(g, P, "W");
  } },
  "animal.adult.A": { name: "시바", size: [12, 10], draw(g, P) {
    // 등 위로 말린 꼬리
    ellipse(g, X(P, -P.rx * 0.85), P.cy - P.ry * 0.55, 3.4, 3.2, "o"); ellipse(g, X(P, -P.rx * 0.85), P.cy - P.ry * 0.55, 1.4, 1.3, "w");
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "o", { shade: "O" });
    ellipse(g, P.cx, P.cy + P.ry * 0.38, P.rx * 0.62, P.ry * 0.55, "w"); // 흰 배·볼
    ellipse(g, X(P, -P.rx * 0.45), P.cy + P.ry * 0.05, P.rx * 0.3, P.ry * 0.22, "w");
    ellipse(g, X(P, P.rx * 0.45), P.cy + P.ry * 0.05, P.rx * 0.3, P.ry * 0.22, "w");
    feet(g, P, "O", 0.5, 2.5);
    for (const s of [-1, 1]) { // 선 귀, 안쪽 흰색 + 알 무늬 색 끝
      tri(g, [X(P, s * P.rx * 0.25), P.cy - P.ry * 0.7], [X(P, s * P.rx * 0.85), P.cy - P.ry * 0.55], [X(P, s * P.rx * 0.65), P.cy - P.ry * 1.5], "o");
      tri(g, [X(P, s * P.rx * 0.42), P.cy - P.ry * 0.72], [X(P, s * P.rx * 0.72), P.cy - P.ry * 0.66], [X(P, s * P.rx * 0.63), P.cy - P.ry * 1.2], "w");
      put(g, X(P, s * P.rx * 0.65), P.cy - P.ry * 1.42, P.spot);
    }
    messyTufts(g, P, "o");
  } },
  "animal.adult.B": { name: "통통 코기", size: [15, 9.5], draw(g, P) {
    ellipse(g, X(P, -P.rx * 1.0), P.cy - P.ry * 0.1, 1.8, 1.6, "o"); // 짧은 꼬리
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "o", { shade: "O" });
    ellipse(g, P.cx, P.cy + P.ry * 0.3, P.rx * 0.7, P.ry * 0.6, "w");
    ellipse(g, P.cx, P.cy - P.ry * 0.55, 1.5, P.ry * 0.35, "w"); // 이마 흰 줄
    feet(g, P, "O", 0.55, 2); // 짧은 다리
    for (const s of [-1, 1]) { // 아주 큰 귀
      tri(g, [X(P, s * P.rx * 0.2), P.cy - P.ry * 0.7], [X(P, s * P.rx * 0.75), P.cy - P.ry * 0.6], [X(P, s * P.rx * 0.55), P.cy - P.ry * 1.75], "o");
      tri(g, [X(P, s * P.rx * 0.33), P.cy - P.ry * 0.75], [X(P, s * P.rx * 0.63), P.cy - P.ry * 0.7], [X(P, s * P.rx * 0.53), P.cy - P.ry * 1.4], P.spot);
    }
    messyTufts(g, P, "o");
  } },
  "animal.adult.C": { name: "여우 고양이", size: [11.5, 10], draw(g, P) {
    // 풍성한 꼬리 (끝은 흰색)
    ellipse(g, X(P, -P.rx * 1.15), P.cy - P.ry * 0.2, 4, 6, "O"); ellipse(g, X(P, -P.rx * 1.2), P.cy - P.ry * 0.85, 2.6, 2.2, "w");
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "O", { shade: "n" });
    ellipse(g, P.cx, P.cy + P.ry * 0.4, P.rx * 0.5, P.ry * 0.5, "w");
    feet(g, P, "N", 0.45, 2.2);
    for (const s of [-1, 1]) { // 큰 귀, 끝이 진함
      tri(g, [X(P, s * P.rx * 0.2), P.cy - P.ry * 0.75], [X(P, s * P.rx * 0.95), P.cy - P.ry * 0.45], [X(P, s * P.rx * 0.8), P.cy - P.ry * 1.75], "O");
      tri(g, [X(P, s * P.rx * 0.7), P.cy - P.ry * 1.3], [X(P, s * P.rx * 0.88), P.cy - P.ry * 1.2], [X(P, s * P.rx * 0.8), P.cy - P.ry * 1.75], "N");
      put(g, X(P, s * P.rx * 0.6), P.cy - P.ry * 0.95, P.spot);
    }
    messyTufts(g, P, "O");
  } },
  "animal.adult.D": { name: "장난꾸러기 고양이", size: [12, 10], draw(g, P) {
    for (let i = 0; i < 11; i++) { const yy = P.cy + P.ry * 0.3 - i * 1.0; put(g, X(P, -P.rx * 0.95 - Math.sin(i / 2) * 2), yy, "W"); put(g, X(P, -P.rx * 0.95 - Math.sin(i / 2) * 2) + 1, yy, "W"); }
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "W", { shade: "L" });
    for (const k of [-0.55, -0.2, 0.15, 0.5]) rect(g, P.cx + P.rx * k - 0.5, P.cy - P.ry * 0.95, 1.2, 3, "L"); // 줄무늬
    rect(g, X(P, P.rx * 0.6), P.cy + P.ry * 0.1, 1, 3, "L"); rect(g, X(P, -P.rx * 0.65), P.cy + P.ry * 0.1, 1, 3, "L");
    feet(g, P, "L", 0.5, 2.3);
    // 한쪽 귀는 쫑긋, 한쪽은 접힘
    tri(g, [X(P, P.rx * 0.3), P.cy - P.ry * 0.75], [X(P, P.rx * 0.9), P.cy - P.ry * 0.5], [X(P, P.rx * 0.75), P.cy - P.ry * 1.5], "W");
    put(g, X(P, P.rx * 0.7), P.cy - P.ry * 1.0, P.spot);
    tri(g, [X(P, -P.rx * 0.3), P.cy - P.ry * 0.8], [X(P, -P.rx * 0.95), P.cy - P.ry * 0.55], [X(P, -P.rx * 1.05), P.cy - P.ry * 0.95], "W");
    // 늘 삐죽한 머리털
    for (const k of [-0.15, 0.1]) tri(g, [X(P, P.rx * k) - 1.2, P.cy - P.ry * 0.9], [X(P, P.rx * k) + 1.2, P.cy - P.ry * 0.9], [X(P, P.rx * k + 0.6), P.cy - P.ry * 1.3], "W");
    messyTufts(g, P, "W");
  } },

  "animal.adult.S": { name: "별빛 사모예드", secret: true, size: [12.5, 10.5], draw(g, P) {
    // 복슬복슬 말린 꼬리
    ellipse(g, X(P, -P.rx * 0.9), P.cy - P.ry * 0.5, 3.8, 3.6, "w"); ellipse(g, X(P, -P.rx * 0.9), P.cy - P.ry * 0.5, 1.6, 1.5, "S");
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "w", { shade: "S" });
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; put(g, P.cx + Math.cos(a) * (P.rx + 0.7), P.cy + Math.sin(a) * (P.ry + 0.7), i % 2 ? "w" : "S"); } // 솜털 테두리
    feet(g, P, "S", 0.5, 2.4);
    for (const s of [-1, 1]) {
      tri(g, [X(P, s * P.rx * 0.3), P.cy - P.ry * 0.75], [X(P, s * P.rx * 0.8), P.cy - P.ry * 0.6], [X(P, s * P.rx * 0.6), P.cy - P.ry * 1.35], "w");
      put(g, X(P, s * P.rx * 0.58), P.cy - P.ry * 1.0, P.spot);
    }
    // 이마의 금빛 별
    const sx = P.cx, sy = P.cy - P.ry * 0.62;
    for (const [dx, dy] of [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]]) put(g, sx + dx, sy + dy, "Y");
  } },
  "fantasy.adult.S": { name: "별 유니콘", secret: true, size: [12.5, 10], draw(g, P) {
    // 무지개 꼬리
    ["p", "v", "b"].forEach((c, i) => ellipse(g, X(P, -P.rx * (1.0 + i * 0.12)), P.cy + P.ry * (0.0 + i * 0.2), 2.4, 2.2, c));
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "w", { shade: "W" });
    feet(g, P, "v", 0.5, 2.3);
    // 무지개 갈기(뒤통수)
    ["p", "y", "b", "v"].forEach((c, i) => ellipse(g, X(P, -P.rx * (0.25 + i * 0.16)), P.cy - P.ry * (0.85 - i * 0.18), 2.2, 2, c));
    // 귀
    tri(g, [X(P, P.rx * 0.45), P.cy - P.ry * 0.7], [X(P, P.rx * 0.8), P.cy - P.ry * 0.55], [X(P, P.rx * 0.7), P.cy - P.ry * 1.15], "w");
    // 금빛 뿔(줄무늬)
    const hx = X(P, P.rx * 0.12);
    tri(g, [hx - 1.6, P.cy - P.ry * 0.85], [hx + 1.6, P.cy - P.ry * 0.85], [hx + 0.4 * P.f, P.cy - P.ry * 1.75], "Y");
    for (const k of [1.05, 1.3]) put(g, hx, P.cy - P.ry * k, "w");
    put(g, X(P, -P.rx * 0.45), P.cy + P.ry * 0.35, P.spot); put(g, X(P, P.rx * 0.5), P.cy + P.ry * 0.4, P.spot);
  } },
  // ===== 상상 속 생물 =====
  "fantasy.baby": { name: "말랑이", size: [7.5, 7], draw(g, P) {
    drop(g, P.cx, P.cy, P.rx, P.ry, "v", "V");
    highlight(g, P);
    put(g, P.cx + P.rx * 0.45, P.cy + P.ry * 0.3, P.spot);
    messyTufts(g, P, "v");
  } },
  "fantasy.child": { name: "뿔말랑이", size: [9.5, 8], draw(g, P) {
    drop(g, P.cx, P.cy, P.rx, P.ry, "v", "V");
    tri(g, [P.cx - 1.5, P.cy - P.ry * 1.45], [P.cx + 1.5, P.cy - P.ry * 1.45], [P.cx + 0.3, P.cy - P.ry * 2.0], "Y"); // 작은 뿔
    highlight(g, P);
    for (const [kx, ky] of [[0.5, 0.25], [-0.55, 0.45], [0.15, 0.6]]) put(g, X(P, P.rx * kx), P.cy + P.ry * ky, P.spot);
    messyTufts(g, P, "v");
  } },
  "fantasy.teen.good": { name: "아기 용", size: [10, 8.5], draw(g, P) {
    // 꼬리 + 가시
    tri(g, [X(P, -P.rx * 0.7), P.cy + P.ry * 0.2], [X(P, -P.rx * 0.7), P.cy + P.ry * 0.8], [X(P, -P.rx * 1.6), P.cy + P.ry * 0.6], "g");
    tri(g, [X(P, -P.rx * 1.4), P.cy + P.ry * 0.35], [X(P, -P.rx * 1.75), P.cy + P.ry * 0.25], [X(P, -P.rx * 1.6), P.cy + P.ry * 0.75], "G");
    // 작은 날개(뒤쪽)
    tri(g, [X(P, -P.rx * 0.3), P.cy - P.ry * 0.4], [X(P, -P.rx * 1.05), P.cy - P.ry * 1.2], [X(P, -P.rx * 0.9), P.cy - P.ry * 0.1], "G");
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "g", { shade: "G" });
    ellipse(g, P.cx, P.cy + P.ry * 0.62, P.rx * 0.5, P.ry * 0.36, "y"); // 배 (얼굴 아래로)
    for (const k of [0.55, 0.78]) rect(g, P.cx - P.rx * 0.35, P.cy + P.ry * k, P.rx * 0.7, 1, "Y");
    feet(g, P, "G", 0.45, 2.2);
    for (const s of [-1, 1]) tri(g, [X(P, s * P.rx * 0.35) - 1, P.cy - P.ry * 0.85], [X(P, s * P.rx * 0.35) + 1, P.cy - P.ry * 0.85], [X(P, s * P.rx * 0.45), P.cy - P.ry * 1.35], "w"); // 뿔
    put(g, P.cx, P.cy - P.ry * 0.7, P.spot);
    messyTufts(g, P, "g");
  } },
  "fantasy.teen.normal": { name: "꼬마 구름", size: [11, 8], draw(g, P) {
    cloud(g, P.cx, P.cy, P.rx, P.ry, "W", "L");
    put(g, X(P, P.rx * 0.55), P.cy + P.ry * 0.4, P.spot); put(g, X(P, -P.rx * 0.6), P.cy + P.ry * 0.45, P.spot);
    messyTufts(g, P, "W");
  } },
  "fantasy.adult.A": { name: "무지개 용", size: [12, 10.5], draw(g, P) {
    tri(g, [X(P, -P.rx * 0.7), P.cy + P.ry * 0.1], [X(P, -P.rx * 0.7), P.cy + P.ry * 0.8], [X(P, -P.rx * 1.7), P.cy + P.ry * 0.7], "b");
    // 큰 날개
    tri(g, [X(P, -P.rx * 0.2), P.cy - P.ry * 0.5], [X(P, -P.rx * 1.35), P.cy - P.ry * 1.45], [X(P, -P.rx * 1.2), P.cy + P.ry * 0.05], "B");
    tri(g, [X(P, -P.rx * 0.35), P.cy - P.ry * 0.45], [X(P, -P.rx * 1.15), P.cy - P.ry * 1.15], [X(P, -P.rx * 1.05), P.cy - P.ry * 0.1], "b");
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "b", { shade: "B" });
    // 무지개 배
    const rainbow = ["r", "o", "y", "g"];
    rainbow.forEach((c, i) => ellipse(g, P.cx, P.cy + P.ry * (0.42 + i * 0.14), P.rx * (0.5 - i * 0.06), 0.9, c));
    feet(g, P, "B", 0.5, 2.4);
    for (const s of [-1, 1]) tri(g, [X(P, s * P.rx * 0.3) - 1.5, P.cy - P.ry * 0.85], [X(P, s * P.rx * 0.3) + 1.5, P.cy - P.ry * 0.85], [X(P, s * P.rx * 0.55), P.cy - P.ry * 1.55], "Y");
    put(g, P.cx, P.cy - P.ry * 0.72, P.spot); put(g, P.cx + 1, P.cy - P.ry * 0.72, P.spot);
    messyTufts(g, P, "b");
  } },
  "fantasy.adult.B": { name: "통통 용", size: [14, 10.5], draw(g, P) {
    ellipse(g, X(P, -P.rx * 0.95), P.cy + P.ry * 0.5, 3, 2, "g");
    tri(g, [X(P, -P.rx * 0.25), P.cy - P.ry * 0.55], [X(P, -P.rx * 0.8), P.cy - P.ry * 1.05], [X(P, -P.rx * 0.7), P.cy - P.ry * 0.3], "G"); // 아주 작은 날개
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "g", { shade: "G" });
    ellipse(g, P.cx, P.cy + P.ry * 0.55, P.rx * 0.6, P.ry * 0.42, "y");
    feet(g, P, "G", 0.5, 2.6);
    for (const s of [-1, 1]) ellipse(g, X(P, s * P.rx * 0.35), P.cy - P.ry * 0.95, 1.6, 1.6, "w"); // 동글 뿔
    for (const [kx, ky] of [[0.6, -0.3], [-0.5, -0.45]]) put(g, X(P, P.rx * kx), P.cy + P.ry * ky, P.spot);
    messyTufts(g, P, "g");
  } },
  "fantasy.adult.C": { name: "구름 고래", size: [15, 8.5], draw(g, P) {
    // 꼬리지느러미(P.wag: 춤출 때 위아래로 살랑, -1 ~ 1)
    const tw = (P.wag || 0) * P.ry * 0.45;
    tri(g, [X(P, -P.rx * 0.85), P.cy], [X(P, -P.rx * 1.35), P.cy - P.ry * 0.9 + tw], [X(P, -P.rx * 1.25), P.cy + P.ry * 0.1 + tw * 0.5], "b");
    tri(g, [X(P, -P.rx * 0.85), P.cy + P.ry * 0.1], [X(P, -P.rx * 1.4), P.cy + P.ry * 0.6 + tw], [X(P, -P.rx * 1.2), P.cy - P.ry * 0.05 + tw * 0.5], "B");
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "b", { shade: "B" });
    ellipse(g, X(P, P.rx * 0.1), P.cy + P.ry * 0.45, P.rx * 0.7, P.ry * 0.45, "w"); // 흰 배
    for (const k of [0.25, 0.45]) rect(g, X(P, -P.rx * 0.4), P.cy + P.ry * k, P.rx, 1, "W");
    // 머리 위 물줄기
    rect(g, X(P, P.rx * 0.25), P.cy - P.ry * 1.45, 1, P.ry * 0.5, "b");
    for (const d of [-2, -1, 1, 2]) put(g, X(P, P.rx * 0.25) + d, P.cy - P.ry * 1.5 - (2 - Math.abs(d)), "b");
    put(g, X(P, -P.rx * 0.35), P.cy - P.ry * 0.4, P.spot); put(g, X(P, -P.rx * 0.2), P.cy - P.ry * 0.55, P.spot);
    // 가슴지느러미(배 옆, 춤출 때 파닥파닥)
    { const fw = (P.wag || 0) * P.ry * 0.5;
      tri(g, [X(P, -P.rx * 0.05), P.cy + P.ry * 0.35], [X(P, -P.rx * 0.45), P.cy + P.ry * 0.75 - fw], [X(P, -P.rx * 0.3), P.cy + P.ry * 0.95 - fw], "B"); }
    messyTufts(g, P, "b");
  } },
  "fantasy.adult.D": { name: "번개 구름", size: [13, 9.5], draw(g, P) {
    cloud(g, P.cx, P.cy, P.rx, P.ry, "W", "L", true);
    // 번개 무늬
    const bx = X(P, -P.rx * 0.55);
    tri(g, [bx, P.cy + P.ry * 0.05], [bx + 3, P.cy + P.ry * 0.05], [bx + 0.5, P.cy + P.ry * 0.55], "Y");
    tri(g, [bx + 0.5, P.cy + P.ry * 0.45], [bx + 2.5, P.cy + P.ry * 0.45], [bx - 0.5, P.cy + P.ry * 0.95], "Y");
    put(g, X(P, P.rx * 0.6), P.cy + P.ry * 0.5, P.spot);
    messyTufts(g, P, "W");
  } },
};

export function formKey(theme, stage, branch) {
  if (stage === "egg") return `${theme}.egg`;
  if (stage === "baby" || stage === "child") return `${theme}.${stage}`;
  return `${theme}.${stage}.${branch || (stage === "teen" ? "good" : "A")}`;
}

// 펫마다 다른 겉모습(알 무늬 색, 통통함, 삐죽함)
export const SPOT_COLORS = ["p", "g", "b", "y", "v", "r"];
export function lookOf(pet) {
  const seed = Math.floor((pet?.bornAt || 0) / 1000);
  const h = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
  const spot = pet?.eggColor || SPOT_COLORS[Math.floor(h * SPOT_COLORS.length)]; // 알 색을 고른 경우 그 색
  const w = pet?.weight || 10;
  return {
    spot, chosen: !!pet?.eggColor,
    spot2: spot === "Y" ? "y" : SPOT_COLORS[(SPOT_COLORS.indexOf(spot) + 2) % SPOT_COLORS.length],
    chub: 1 + Math.min(0.25, Math.max(0, (w - 20) * 0.02)),
    messy: (pet?.mistakes?.total || 0) >= 6,
  };
}

// 격자에 캐릭터를 칠한다. 결과: { g, P } (얼굴을 얹을 기준점 포함)
export function buildCreature(key, { sx = 1, sy = 1, facing = 1, look = {}, silhouette = null, wag = null } = {}) {
  const form = FORMS[key];
  if (!form) return null;
  const g = grid();
  const [rx0, ry0] = form.size;
  const rx = rx0 * sx * (look.chub || 1), ry = ry0 * sy;
  const base = GH - 2;
  const P = { cx: GW / 2, cy: base - ry, rx, ry, base, f: facing >= 0 ? 1 : -1, spot: look.spot || "p", messy: !!look.messy, faceUp: 0, wag: wag || 0 };
  form.draw(g, P);
  if (silhouette) for (let i = 0; i < g.c.length; i++) if (g.c[i]) g.c[i] = silhouette;
  outline(g);
  return { g, P, form };
}

// 격자를 화면에 그린다. (x, base)는 발밑 가운데(논리 px), s는 칸당 px
export function paintGrid(ctx, g, x, base, s, { alpha = 1, tint = null } = {}) {
  const ox = Math.round(x - (g.w / 2) * s), oy = Math.round(base - (g.h - 2) * s);
  ctx.globalAlpha = alpha;
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (let y = 0; y < g.h; y++) for (let xx = 0; xx < g.w; xx++) {
    const col = g.c[y * g.w + xx];
    if (!col) continue;
    ctx.fillStyle = PALETTE[col] || col;
    ctx.fillRect(ox + xx * s, oy + y * s, s, s);
    if (xx < minX) minX = xx; if (xx > maxX) maxX = xx; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (tint) {
    ctx.fillStyle = tint;
    for (let y = 0; y < g.h; y++) for (let xx = 0; xx < g.w; xx++) { const c = g.c[y * g.w + xx]; if (c && c !== "k") ctx.fillRect(ox + xx * s, oy + y * s, s, s); }
  }
  ctx.globalAlpha = 1;
  return { x: ox + minX * s, y: oy + minY * s, w: (maxX - minX + 1) * s, h: (maxY - minY + 1) * s, ox, oy };
}

// 알 그림: 무늬 색을 펫 색으로. 상상 테마는 기본이 무지개 알이고, 알 색을 고른 경우만 그 색 무늬
export function eggSpriteFor(SPRITES, theme, l) {
  if (theme === "fantasy" && !(l && l.chosen)) return SPRITES.eggRainbow;
  if (!l || !l.spot) return SPRITES.egg;
  return SPRITES.egg.map((row) => row.replace(/p/g, "#").replace(/g/g, l.spot2 || "g").replace(/#/g, l.spot));
}
