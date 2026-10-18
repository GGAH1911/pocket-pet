// 숲속 친구들 계통(시안). creature.js 의 FORMS 와 같은 형식이라 나중에 Object.assign(FORMS, FORMS_FOREST) 만 하면 된다.
// 핏줄: 도토리 털뭉치 → 아기 다람쥐 → (잘 돌봄) 꼬마 다람쥐 → 날다람쥐 / 통통 볼다람쥐
//                                   → (보통)   꼬마 고슴도치 → 꽃 고슴도치 / 삐죽 고슴도치
//        숨은 어른: 달빛 부엉이
// 다람쥐 쪽은 붉은 청설모 톤(SQ), 고슴도치 쪽은 갈색.
// 얼굴은 face.js 의 drawFace 가 공통으로 얹으므로 여기서는 몸·무늬·귀·뿔·꼬리만 그린다.
// creature.js 의 헬퍼가 export 되어 있지 않아 같은 구현을 복사해 두었다(합칠 때는 이 복사본을 지우고 원본을 쓰면 됨).

// ---------- 헬퍼(creature.js 와 같은 구현) ----------
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
const X = (P, dx) => P.cx + dx * P.f;
function feet(g, P, col, spread = 0.5, size = 2.2) {
  ellipse(g, X(P, -P.rx * spread), P.base - 1, size, 1.6, col, { onlyEmpty: true });
  ellipse(g, X(P, P.rx * spread), P.base - 1, size, 1.6, col, { onlyEmpty: true });
}
function messyTufts(g, P, col) {
  if (!P.messy) return;
  for (const k of [-0.45, 0, 0.45]) tri(g, [X(P, P.rx * k) - 1.5, P.cy - P.ry * 0.85], [X(P, P.rx * k) + 1.5, P.cy - P.ry * 0.85], [X(P, P.rx * k + 0.8), P.cy - P.ry * 1.35], col);
}

// ---------- 숲속 전용 헬퍼 ----------
// 몸 뒤에 놓이는 부위(꼬리·날개막): 빈 칸에만 칠하고, 몸과 맞닿는 줄은 테두리색으로 갈라 같은 털색이어도 모양이 읽히게 한다.
function behind(g, drawFn) {
  const t = { w: g.w, h: g.h, c: new Array(g.w * g.h).fill(null) };
  drawFn(t);
  const before = g.c.slice();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const i = y * g.w + x, col = t.c[i];
    if (!col || before[i]) continue;
    const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < g.w && ny < g.h && before[ny * g.w + nx] && before[ny * g.w + nx] !== "k";
    });
    g.c[i] = touches ? "k" : col;
  }
}
// 타원의 위쪽 일부만(도토리 모자)
function capEllipse(g, cx, cy, rx, ry, col, maxY, alt = null) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.min(maxY, Math.ceil(cy + ry + 1)); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) put(g, x, y, alt && (x + y) % 3 === 0 ? alt : col);
    }
  }
}
// 청설모 색: 시바의 주황(o/O)과 헷갈리지 않게 더 붉고 어두운 적갈색.
// 팔레트(palette.js)에 아직 없는 색이라 hex 로 둔다(paintGrid 는 PALETTE[col] || col 이라 hex 도 그대로 칠해짐).
// 게임에 합칠 때 palette.js 에 글자 3개(예: q=#c9592f, Q=#8e3a22, T=#5e2618)를 추가하고 아래 값을 바꾸면 된다.
const SQ = "#c9592f", SQ_D = "#8e3a22", SQ_TIP = "#5e2618";
// 청설모 꼬리: 엉덩이에서 뒤로 나와 위로 솟고 끝이 머리 쪽으로 말리는 S자. 끝은 진한 색.
function squirrelTail(g, P, scale, col = SQ, tip = SQ_TIP) {
  behind(g, (t) => {
    const pts = [ // [뒤로(칸), 위로(ry 배수), 반지름] — 아래는 뒤로 불룩, 위는 머리 쪽으로 말림
      [0.0, -0.5, 1.6], [1.8, -0.3, 2.0], [3.3, 0.05, 2.4], [3.9, 0.5, 2.6], [3.5, 0.95, 2.8], [2.3, 1.3, 2.8], [0.9, 1.42, 2.3],
    ];
    const k = Math.min(1.15, scale);
    for (const [b, u, r] of pts) ellipse(t, X(P, -P.rx - b * scale), P.cy - P.ry * u * k, r * scale, r * scale, col);
    ellipse(t, X(P, -P.rx - 2.3 * scale), P.cy - P.ry * 1.05 * k, 1.1 * scale, 1.0 * scale, "o"); // 말림 안쪽 밝은 털
    ellipse(t, X(P, -P.rx + 0.1 * scale), P.cy - P.ry * 1.36 * k, 1.8 * scale, 1.6 * scale, tip); // 머리 쪽으로 늘어진 진한 끝
    ellipse(t, X(P, -P.rx + 0.8 * scale), P.cy - P.ry * 1.18 * k, 1.1 * scale, 1.1 * scale, tip);
  });
}
// 청설모 귀: 뾰족 귀 + 끝의 털 뭉치
function tuftEar(g, x, y, s, f, col, tuft, inner) {
  tri(g, [x - 1.8, y + 1.6], [x + 1.8, y + 1.6], [x + 0.3 * s * f, y - 2.4], col);
  put(g, x + 0.3 * s * f, y - 2.6, tuft); put(g, x + 0.3 * s * f + s * f, y - 3.4, tuft); put(g, x + 0.3 * s * f, y - 3.4, tuft); put(g, x + 0.3 * s * f - s * f, y - 3.9, tuft);
  if (inner) put(g, x, y + 0.4, inner);
}
// 고슴도치 가시: 위쪽 둥근 테를 따라 바깥으로 뾰족뾰족
function spines(g, P, { n, len, col, tip, a0 = Math.PI * 1.05, a1 = Math.PI * 1.95, jag = 0, cy = P.cy }) {
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / (n - 1);
    const L = len * (jag && i % 2 ? jag : 1);
    const bx = P.cx + Math.cos(a) * P.rx * 0.92, by = cy + Math.sin(a) * P.ry * 0.92;
    const tx = P.cx + Math.cos(a) * (P.rx + L), ty = cy + Math.sin(a) * (P.ry + L);
    const px = -Math.sin(a) * 1.6, py = Math.cos(a) * 1.6;
    tri(g, [bx + px, by + py], [bx - px, by - py], [tx, ty], col);
    if (tip) put(g, tx - Math.cos(a) * 0.8, ty - Math.sin(a) * 0.8, typeof tip === "function" ? tip(i) : tip);
  }
}
function flower(g, x, y, petal, center = "y") {
  for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) put(g, x + dx, y + dy, petal);
  put(g, x, y, center);
}
function leaf(g, x, y, f = 1) {
  put(g, x, y, "G"); put(g, x + f, y, "g"); put(g, x + f, y - 1, "g"); put(g, x + 2 * f, y - 1, "G");
}

export const FORMS_FOREST = {
  // 아기: 도토리 모자를 쓴 갈색 털뭉치
  "forest.baby": { name: "도토리 털뭉치", size: [7.5, 7], draw(g, P) {
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "n", { shade: "N", shadeFrom: 0.55 });
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; if (Math.sin(a) > -0.3) put(g, P.cx + Math.cos(a) * (P.rx + 0.6), P.cy + Math.sin(a) * (P.ry + 0.6), i % 3 ? "n" : "N"); } // 솜털(모자 아래쪽만)
    capEllipse(g, P.cx, P.cy - P.ry * 0.5, P.rx * 1.12, P.ry * 0.68, "N", Math.round(P.cy - P.ry * 0.38), "n"); // 도토리 모자(빗살 무늬)
    rect(g, P.cx, P.cy - P.ry * 1.3, 1, 2, "N"); // 꼭지
    leaf(g, P.cx + 1, P.cy - P.ry * 1.2, 1);
    put(g, X(P, -P.rx * 0.55), P.cy + P.ry * 0.45, P.spot); put(g, X(P, -P.rx * 0.55) + 1, P.cy + P.ry * 0.45, P.spot); // 알 무늬 한 점
    messyTufts(g, P, "n");
  } },
  // 어린이: 귀털 달린 뾰족 귀, S자 꼬리, 아래가 살짝 넓은 몸(공처럼 동그랗지 않게)
  "forest.child": { name: "아기 다람쥐", size: [8.8, 8], draw(g, P) {
    ellipse(g, P.cx, P.cy + P.ry * 0.18, P.rx, P.ry * 0.82, SQ, { shade: SQ_D, shadeFrom: 0.5 }); // 아래 몸
    ellipse(g, P.cx, P.cy - P.ry * 0.2, P.rx * 0.86, P.ry * 0.78, SQ); // 머리(조금 좁게)
    ellipse(g, P.cx, P.cy + P.ry * 0.5, P.rx * 0.5, P.ry * 0.42, "w"); // 크림 배
    feet(g, P, SQ_D, 0.45, 2);
    for (const s of [-1, 1]) tuftEar(g, X(P, s * P.rx * 0.55), P.cy - P.ry * 0.95, s, P.f, SQ, SQ_D, s > 0 ? P.spot : null);
    squirrelTail(g, P, 0.85);
    messyTufts(g, P, SQ);
  } },
  // 청소년(잘 돌봄): 이마 줄무늬, 꼬리가 커짐
  "forest.teen.good": { name: "꼬마 다람쥐", size: [10, 8.5], draw(g, P) {
    ellipse(g, P.cx, P.cy + P.ry * 0.12, P.rx, P.ry * 0.88, SQ, { shade: SQ_D, shadeFrom: 0.5 });
    ellipse(g, P.cx, P.cy - P.ry * 0.15, P.rx * 0.9, P.ry * 0.8, SQ);
    ellipse(g, P.cx, P.cy + P.ry * 0.48, P.rx * 0.52, P.ry * 0.44, "w");
    for (const [dx, col] of [[-1, "w"], [0, SQ_D], [1, "w"]]) rect(g, P.cx + dx, P.cy - P.ry * 0.95, 1, 3, col); // 이마 줄무늬
    feet(g, P, SQ_D, 0.5);
    for (const s of [-1, 1]) tuftEar(g, X(P, s * P.rx * 0.6), P.cy - P.ry * 0.92, s, P.f, SQ, SQ_D, "o");
    squirrelTail(g, P, 1.0);
    put(g, X(P, -P.rx - 3), P.cy, P.spot); put(g, X(P, -P.rx - 3), P.cy + 1, P.spot); // 꼬리 알 무늬
    messyTufts(g, P, SQ);
  } },
  // 청소년(보통): 동그란 가시 등, 베이지 얼굴
  "forest.teen.normal": { name: "꼬마 고슴도치", size: [9.5, 8.5], draw(g, P) {
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "N", { shade: "N" });
    spines(g, P, { n: 8, len: 2.4, col: "N", a0: Math.PI * 0.95, a1: Math.PI * 2.05, tip: (i) => (i === 2 || i === 5 ? P.spot : "n") });
    ellipse(g, P.cx, P.cy + P.ry * 0.26, P.rx * 0.72, P.ry * 0.7, "s", { shade: "S", shadeFrom: 0.5 }); // 얼굴·배
    feet(g, P, "S", 0.45, 2);
    for (const s of [-1, 1]) ellipse(g, X(P, s * P.rx * 0.62), P.cy - P.ry * 0.55, 1.3, 1.3, "s"); // 작은 귀
    messyTufts(g, P, "N");
  } },
  // 어른 A(잘 돌봄 + 놀이 많음): 손목에서 발목까지 몸 옆에 얇은 막이 이어진 날다람쥐
  "forest.adult.A": { name: "날다람쥐", size: [11.5, 10], draw(g, P) {
    // 몸 옆 얇은 막: 손목(몸 옆 위) ~ 발목(발 옆)을 잇는 납작한 삼각형. 피부라 몸과 테두리 없이 이어지고, 바깥 가장자리만 크림색 줄
    for (const s of [-1, 1]) {
      const wx = P.cx + s * P.rx * 0.85, wy = P.cy - P.ry * 0.35; // 손목
      const ax = P.cx + s * P.rx * 0.7, ay = P.base - 1.5; // 발목
      const ox = P.cx + s * (P.rx + 3.4), oy = P.cy + P.ry * 0.3; // 막의 바깥 꼭짓점
      tri(g, [wx, wy], [ax, ay], [ox, oy], SQ_D);
      for (let k = 0; k <= 6; k++) { const q = k / 6; put(g, wx + (ox - wx) * q, wy + (oy - wy) * q, "s"); put(g, ox + (ax - ox) * q, oy + (ay - oy) * q, "s"); }
      put(g, ox - s * 0.6, oy, P.spot);
    }
    ellipse(g, P.cx, P.cy + P.ry * 0.1, P.rx, P.ry * 0.9, SQ, { shade: SQ_D, shadeFrom: 0.5 });
    ellipse(g, P.cx, P.cy - P.ry * 0.15, P.rx * 0.9, P.ry * 0.82, SQ);
    ellipse(g, P.cx, P.cy + P.ry * 0.45, P.rx * 0.5, P.ry * 0.46, "w");
    for (const s of [-1, 1]) { put(g, P.cx + s * P.rx * 0.85, P.cy - P.ry * 0.35, SQ_TIP); put(g, P.cx + s * P.rx * 0.85, P.cy - P.ry * 0.35 + 1, SQ_TIP); } // 손목
    feet(g, P, SQ_D, 0.5, 2.3);
    for (const s of [-1, 1]) tuftEar(g, X(P, s * P.rx * 0.58), P.cy - P.ry * 0.92, s, P.f, SQ, SQ_D, "o");
    squirrelTail(g, P, 1.0);
    messyTufts(g, P, SQ);
  } },
  // 어른 B(잘 돌봄 + 간식 많음): 볼주머니 가득, 도토리를 꼭 안은 통통이
  "forest.adult.B": { name: "통통 볼다람쥐", size: [14.5, 9.5], draw(g, P) {
    ellipse(g, P.cx, P.cy, P.rx, P.ry, SQ, { shade: SQ_D, shadeFrom: 0.6 });
    ellipse(g, P.cx, P.cy + P.ry * 0.5, P.rx * 0.6, P.ry * 0.5, "w"); // 큰 배
    for (const s of [-1, 1]) { // 몸 밖으로 불룩 튀어나온 볼주머니(도토리 가득)
      ellipse(g, P.cx + s * (P.rx - 0.6), P.cy + P.ry * 0.12, 2.8, 2.6, SQ);
      ellipse(g, P.cx + s * (P.rx - 0.3), P.cy + P.ry * 0.2, 1.5, 1.4, "w");
    }
    for (const [dx, col] of [[-1, "w"], [0, SQ_D], [1, "w"]]) rect(g, X(P, P.rx * 0.12) + dx, P.cy - P.ry * 0.98, 1, 3, col); // 이마 줄무늬
    feet(g, P, SQ_D, 0.55, 2.2);
    for (const s of [-1, 1]) tuftEar(g, X(P, s * P.rx * 0.48), P.cy - P.ry * 0.9, s, P.f, SQ, SQ_D, P.spot);
    // 안고 있는 도토리
    const ax = P.cx, ay = Math.round(P.cy + P.ry * 0.68);
    ellipse(g, ax, ay + 0.5, 1.8, 1.6, "n");
    rect(g, ax - 2, ay - 1, 4, 1, "N"); put(g, ax, ay - 2, "N");
    squirrelTail(g, P, 1.15);
    messyTufts(g, P, SQ);
  } },
  // 어른 C(보통 + 실수 적음): 가시가 가지런하고 등에 꽃을 꽂은 고슴도치
  "forest.adult.C": { name: "꽃 고슴도치", size: [11.5, 9.5], draw(g, P) {
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "N", { shade: "N" });
    spines(g, P, { n: 9, len: 1.6, col: "N", tip: "n" });
    ellipse(g, X(P, P.rx * 0.08), P.cy + P.ry * 0.22, P.rx * 0.8, P.ry * 0.74, "s", { shade: "S", shadeFrom: 0.5 });
    feet(g, P, "S", 0.5, 2.3);
    for (const s of [-1, 1]) ellipse(g, X(P, s * P.rx * 0.6 + P.rx * 0.08), P.cy - P.ry * 0.55, 1.4, 1.4, "s");
    flower(g, X(P, -P.rx * 0.42), P.cy - P.ry * 0.98, P.spot);
    flower(g, X(P, -P.rx * 0.05), P.cy - P.ry * 1.12, "w");
    leaf(g, X(P, -P.rx * 0.72), P.cy - P.ry * 0.75, -P.f);
    messyTufts(g, P, "N");
  } },
  // 어른 D(보통 + 실수 많음): 가시가 사방으로 삐죽, 나뭇잎이 붙은 장난꾸러기
  "forest.adult.D": { name: "삐죽 고슴도치", size: [12, 10], draw(g, P) {
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "N", { shade: "N" });
    spines(g, P, { n: 11, len: 2.8, col: "N", jag: 0.45, a0: Math.PI * 0.95, a1: Math.PI * 2.05, tip: (i) => (i % 4 === 1 ? P.spot : "n") });
    tri(g, [X(P, P.rx * 0.05) - 1.5, P.cy - P.ry * 0.9], [X(P, P.rx * 0.05) + 1.5, P.cy - P.ry * 0.9], [X(P, P.rx * 0.3), P.cy - P.ry * 1.6], "N"); // 한 가닥 솟은 가시
    ellipse(g, X(P, P.rx * 0.08), P.cy + P.ry * 0.24, P.rx * 0.78, P.ry * 0.72, "s", { shade: "S", shadeFrom: 0.5 });
    feet(g, P, "S", 0.5, 2.3);
    ellipse(g, X(P, P.rx * 0.66), P.cy - P.ry * 0.55, 1.4, 1.4, "s"); // 쫑긋 귀
    ellipse(g, X(P, -P.rx * 0.5), P.cy - P.ry * 0.5, 1.6, 1.1, "s"); // 접힌 귀
    leaf(g, X(P, -P.rx * 0.6), P.cy - P.ry * 1.05, P.f); leaf(g, X(P, P.rx * 0.55), P.cy - P.ry * 1.15, -P.f); // 붙어 온 나뭇잎
    messyTufts(g, P, "N");
  } },
  // 숨은 어른 S(실수 0 + 쓰다듬기 30): 흰·연보라 깃에 금빛 초승달, 귀깃 두 개, 날개를 살짝 접은 동글한 부엉이
  "forest.adult.S": { name: "달빛 부엉이", secret: true, size: [11.5, 10.5], draw(g, P) {
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "v", { shade: "V", shadeFrom: 0.75 }); // 연보라 깃
    // 얼굴판: 눈 둘레 흰 깃(하트 모양) — 눈 위치는 drawFace 와 같은 계산
    const fcx = P.cx + (P.rx >= 10 ? P.f * Math.round(P.rx * 0.12) : 0), eyeY = Math.round(P.cy - P.ry * 0.12), edx = Math.max(2, Math.round(P.rx * 0.38));
    for (const s of [-1, 1]) ellipse(g, fcx + s * edx, eyeY + 0.5, P.rx * 0.36, P.ry * 0.34, "w");
    ellipse(g, fcx, eyeY + P.ry * 0.3, P.rx * 0.32, P.ry * 0.3, "w");
    ellipse(g, P.cx, P.cy + P.ry * 0.62, P.rx * 0.5, P.ry * 0.36, "w"); // 흰 가슴
    for (const [kx, ky] of [[-0.25, 0.6], [0.25, 0.6], [0, 0.78]]) { const x = P.cx + P.rx * kx, y = P.cy + P.ry * ky; put(g, x - 1, y, "v"); put(g, x + 1, y, "v"); put(g, x, y + 1, "v"); } // 가슴 깃 무늬
    put(g, fcx, eyeY + 1, "o"); // 작은 부리
    // 귀깃: 가늘고 바깥으로 기운 깃 두 가닥
    for (const s of [-1, 1]) {
      tri(g, [P.cx + s * P.rx * 0.38, P.cy - P.ry * 0.82], [P.cx + s * P.rx * 0.68, P.cy - P.ry * 0.72], [P.cx + s * P.rx * 0.78, P.cy - P.ry * 1.3], "v");
      put(g, P.cx + s * P.rx * 0.74, P.cy - P.ry * 1.2, "V");
    }
    // 살짝 접은 날개(몸 양옆, 진보라 + 흰 깃끝)
    for (const s of [-1, 1]) {
      ellipse(g, P.cx + s * P.rx * 0.86, P.cy + P.ry * 0.32, P.rx * 0.26, P.ry * 0.52, "V");
      for (const k of [0.45, 0.65]) put(g, P.cx + s * P.rx * 0.86, P.cy + P.ry * k, "w");
      put(g, P.cx + s * P.rx * 0.84, P.cy + P.ry * 0.1, "Y"); // 날개의 금빛 점
    }
    // 이마의 금빛 초승달
    { const mx = Math.round(P.cx), my = Math.round(P.cy - P.ry * 0.68);
      for (const [dx, dy] of [[0, -2], [1, -2], [-1, -1], [-1, 0], [-1, 1], [0, 2], [1, 2]]) put(g, mx + dx * P.f, my + dy, "Y"); }
    feet(g, P, "o", 0.32, 1.8); // 작은 주황 발
    put(g, P.cx - P.rx * 0.18, P.cy - P.ry * 0.95, P.spot); put(g, P.cx + P.rx * 0.18, P.cy - P.ry * 0.95, P.spot); // 정수리 알 무늬
  } },
};

// 알: 기본 알 모양에 잎사귀(초록)와 도토리(갈색) 무늬
export const FOREST_EGG = [
  "......kkkk......",
  "....kkwwwwkk....",
  "...kwwwwwwwwk...",
  "..kwwGwwwwwwwk..",
  "..kwGgGwwwNNwk..",
  ".kwwgGwwwwnnwwk.",
  ".kwwwwwwwwwwwwk.",
  ".kwNNwwwwwwwwwk.",
  "kwwnnwwwwwwGwwwk",
  "kwwwwwwwwwGgGwwk",
  "kwwwwwwwwwgGwwwk",
  "kwwGwwwNNwwwwwwk",
  "kwGgGwwnnwwwwwwk",
  ".kwgGwwwwwwwNNk.",
  ".kswwwwwwwwwnnk.",
  "..kssswwwwsssk..",
  "...kkssssssskk..",
  ".....kkkkkk.....",
];
