// 바닷가 친구들 계통(시안). creature.js 의 FORMS 와 같은 형식이라 나중에
// Object.assign(FORMS, FORMS_SEA) 로 합치기만 하면 된다. 아직 게임에는 연결하지 않았다.
// 핏줄: 솜방울(아기 물범) → 아기 물범 → 꼬마 물범(착함) / 꼬마 펭귄(보통)
//   착함+놀이 → 공놀이 돌고래(A), 착함+간식 → 통통 물범(B)
//   보통+실수 적음 → 멋쟁이 펭귄(C), 보통+실수 많음 → 삐죽머리 펭귄(D)
//   숨은(실수 0 + 쓰다듬기 30) → 별빛 해달(S)
// 얼굴(눈·입·볼)은 face.js 의 drawFace 가 공통으로 얹는다. 여기서는 몸·무늬·지느러미만.

// ---------- 도형 헬퍼 (creature.js 와 같은 구현: 거기서 export 하지 않아 복사) ----------
function put(g, x, y, col, onlyEmpty = false) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  const i = y * g.w + x;
  if (onlyEmpty && g.c[i]) return;
  g.c[i] = col;
}
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
const X = (P, dx) => P.cx + dx * P.f;
function feet(g, P, col, spread = 0.5, size = 2.2) {
  ellipse(g, X(P, -P.rx * spread), P.base - 1, size, 1.6, col, { onlyEmpty: true });
  ellipse(g, X(P, P.rx * spread), P.base - 1, size, 1.6, col, { onlyEmpty: true });
}
function messyTufts(g, P, col) {
  if (!P.messy) return;
  for (const k of [-0.45, 0, 0.45]) tri(g, [X(P, P.rx * k) - 1.5, P.cy - P.ry * 0.85], [X(P, P.rx * k) + 1.5, P.cy - P.ry * 0.85], [X(P, P.rx * k + 0.8), P.cy - P.ry * 1.35], col);
}

// ---------- 바닷가 전용 부품 ----------
// 얼굴 기준점: face.js drawFace 와 같은 계산(수염·부리를 얼굴 옆에 맞추려고)
function faceAt(P) {
  const fcx = P.cx + (P.rx >= 10 ? P.f * Math.round(P.rx * 0.12) : 0);
  const eyeY = Math.round(P.cy - P.ry * 0.12) - (P.faceUp || 0);
  const edx = Math.max(2, Math.round(P.rx * 0.38));
  const my = eyeY + Math.max(3, Math.round(P.ry * 0.32));
  return { fcx, eyeY, edx, my };
}
// 물범 수염: 볼 바깥쪽에 짧은 점 두 줄
function whiskers(g, P, col) {
  const { fcx, edx, my } = faceAt(P);
  for (const s of [-1, 1]) {
    put(g, fcx + s * (edx + 1), my, col); put(g, fcx + s * (edx + 2), my - 1, col);
    put(g, fcx + s * (edx + 2), my + 1, col);
  }
}
// 물범 뒷지느러미(꼬리 쪽, 두 갈래). wag 로 살랑
function tailFlippers(g, P, col, k = 1) {
  const w = (P.wag || 0) * 1.2;
  const bx = X(P, -P.rx * 0.82), by = P.cy + P.ry * 0.55;
  tri(g, [bx, by - 1.2 * k], [bx, by + 1.2 * k], [X(P, -P.rx * 0.82 - 3.4 * k), by - 2.2 * k + w], col);
  tri(g, [bx, by - 0.6 * k], [bx, by + 1.6 * k], [X(P, -P.rx * 0.82 - 3.2 * k), by + 1.8 * k - w], col);
}
// 앞지느러미: 몸 아래 양옆으로 납작
function flippers(g, P, col, spread = 0.62, w = 2.4, h = 1.3) {
  for (const s of [-1, 1]) ellipse(g, X(P, s * P.rx * spread), P.base - 1.1, w, h, col, { onlyEmpty: true });
}
// 펭귄 날개: 몸 양옆에 붙은 납작한 삼각형. up=1 이면 앞쪽 날개를 번쩍
function penguinWings(g, P, col, up = 0) {
  for (const s of [-1, 1]) {
    const x0 = X(P, s * P.rx * 0.9), y0 = P.cy - P.ry * 0.1;
    if (up && s === 1) tri(g, [x0 - 2 * P.f, y0 + 2], [x0 - P.f, y0 - 2.5], [X(P, s * (P.rx + 3.6)), y0 - P.ry * 0.8], col);
    else tri(g, [x0 - s * P.f, y0 - 1], [x0 - s * P.f * 0.5, y0 + P.ry * 0.5], [X(P, s * (P.rx + 2.2)), y0 + P.ry * 0.62], col);
  }
}
// 펭귄 몸: 등(파랑) + 얼굴·배를 덮는 흰 가면, 이마 가운데는 등색이 살짝 내려옴
function penguinBody(g, P, col = "B", mask = "w", maskShade = "W") {
  ellipse(g, P.cx, P.cy, P.rx, P.ry, col);
  const { fcx } = faceAt(P);
  ellipse(g, fcx, P.cy + P.ry * 0.18, P.rx * 0.78, P.ry * 0.8, mask, { shade: maskShade, shadeFrom: 0.6 });
  tri(g, [fcx - 1.6, P.cy - P.ry * 0.62], [fcx + 1.6, P.cy - P.ry * 0.62], [fcx, P.cy - P.ry * 0.28], col); // 이마 뾰족
}
// 작은 부리: 두 눈 사이 아래(입 위)에 주황 두 칸
function beak(g, P) {
  const { fcx, eyeY } = faceAt(P);
  put(g, fcx - 0.5, eyeY + 1, "o"); put(g, fcx + 0.5, eyeY + 1, "o");
}
// 글자 그림을 그대로 찍기('.'은 건너뜀)
function stampArt(g, art, cx, cy) {
  const h = art.length, w = art[0].length;
  const x0 = Math.round(cx - (w - 1) / 2), y0 = Math.round(cy - (h - 1) / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (art[y][x] !== ".") put(g, x0 + x, y0 + y, art[y][x]);
}
// 줄무늬 비치볼
function beachBall(g, cx, cy, r) {
  const cols = ["r", "w", "b"];
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
    const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / r;
    if (dx * dx + dy * dy > 1) continue;
    const band = Math.min(cols.length - 1, Math.floor(((dx + 1) / 2) * cols.length));
    put(g, x, y, dx * dx + dy * dy < 0.12 && dy < 0 ? "w" : cols[band]);
  }
}
const STARFISH = [
  "...k...",
  "..kYk..",
  "kkYYYkk",
  "kYYoYYk",
  ".kYYYk.",
  ".kYkYk.",
  ".kk.kk.",
];

export const FORMS_SEA = {
  "sea.baby": { name: "솜방울", desc: "바닷가에서 태어난 하얀 솜털 아기 물범", size: [7.5, 7], draw(g, P) {
    tailFlippers(g, P, "W", 0.85);
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "w", { shade: "W" });
    put(g, X(P, -1), P.cy - P.ry - 0.6, "w"); put(g, X(P, -2), P.cy - P.ry - 1.4, "w"); // 정수리 솜털 한 가닥
    flippers(g, P, "W", 0.85, 2, 1.2); // 몸 옆으로 살짝 삐져나온 앞지느러미
    put(g, P.cx, P.cy - P.ry - 1, P.spot); put(g, P.cx + 1, P.cy - P.ry - 1, P.spot); // 머리 위 알 무늬 한 점(털뭉치와 같은 자리)
    messyTufts(g, P, "w");
  } },
  "sea.child": { name: "아기 물범", desc: "앞지느러미로 모래밭을 꼼지락꼼지락", size: [9.5, 8], draw(g, P) {
    tailFlippers(g, P, "W", 0.9);
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "w", { shade: "W" });
    ellipse(g, X(P, -P.rx * 0.45), P.cy - P.ry * 0.62, 1.4, 1, P.spot); // 등에 알 무늬 점
    put(g, X(P, -P.rx * 0.15), P.cy - P.ry * 0.8, P.spot);
    flippers(g, P, "W", 0.6, 2.3, 1.3);
    whiskers(g, P, "L");
    messyTufts(g, P, "w");
  } },
  "sea.teen.good": { name: "꼬마 물범", desc: "점박이 무늬가 생기고 헤엄을 배워요", size: [10, 8.5], draw(g, P) {
    tailFlippers(g, P, "L", 1);
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "W", { shade: "L" });
    ellipse(g, P.cx, P.cy + P.ry * 0.45, P.rx * 0.6, P.ry * 0.45, "w"); // 밝은 배
    [[-0.6, -0.45], [-0.3, -0.75], [0.45, -0.72], [-0.75, 0.05], [0.8, -0.2]].forEach(([kx, ky], i) => put(g, X(P, P.rx * kx), P.cy + P.ry * ky, i % 2 ? "b" : "L")); // 점박이(회색·하늘색 섞임: 바다 빛)
    put(g, X(P, -P.rx * 0.5), P.cy - P.ry * 0.15, P.spot); put(g, X(P, -P.rx * 0.45) , P.cy - P.ry * 0.15, P.spot);
    flippers(g, P, "L", 0.6, 2.5, 1.4);
    whiskers(g, P, "L");
    messyTufts(g, P, "W");
  } },
  "sea.teen.normal": { name: "꼬마 펭귄", desc: "뒤뚱뒤뚱, 파도 앞에서 망설이는 중", size: [9.5, 8.5], draw(g, P) {
    penguinWings(g, P, "B");
    penguinBody(g, P);
    beak(g, P);
    feet(g, P, "o", 0.42, 2);
    put(g, X(P, -P.rx * 0.55), P.cy - P.ry * 0.65, P.spot); // 등 무늬
    messyTufts(g, P, "B");
  } },
  "sea.adult.A": { name: "공놀이 돌고래", desc: "머리 위로 공을 통통, 파도타기 놀이가 제일 좋아", size: [13, 9.5], draw(g, P) {
    // 꼬리지느러미: 몸 뒤로 나와 옆으로 살짝 벌어진 두 갈래(P.wag 로 위아래 살랑)
    const tw = (P.wag || 0) * P.ry * 0.35;
    const ty = P.cy + P.ry * 0.1;
    ellipse(g, X(P, -P.rx * 1.02), ty, 3, 1.6, "B"); // 꼬리자루
    tri(g, [X(P, -P.rx * 1.05), ty - 0.8], [X(P, -P.rx * 1.05 - 5), ty - 4.4 + tw], [X(P, -P.rx * 1.05 - 3.2), ty + 0.6 + tw * 0.5], "B");
    tri(g, [X(P, -P.rx * 1.05), ty + 0.8], [X(P, -P.rx * 1.05 - 5), ty + 3.6 + tw], [X(P, -P.rx * 1.05 - 3.2), ty - 0.6 + tw * 0.5], "B");
    // 등지느러미: 등 가운데에서 뒤로 휘어진 삼각형
    tri(g, [X(P, -P.rx * 0.4), P.cy - P.ry * 0.82], [X(P, P.rx * 0.1), P.cy - P.ry * 0.9], [X(P, -P.rx * 0.48), P.cy - P.ry * 1.5], "B");
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "b", { shade: "B", shadeFrom: 0.72 });
    // 짧은 주둥이: 얼굴 앞쪽으로 동글게 튀어나옴(위는 하늘, 아래는 흰색)
    const sx = X(P, P.rx * 1.06), sy = P.cy + P.ry * 0.28;
    ellipse(g, sx, sy, 3.6, 1.6, "b");
    ellipse(g, sx, sy + 0.9, 3.2, 0.9, "w");
    put(g, X(P, P.rx * 0.9), sy - 1.6, "B"); put(g, X(P, P.rx * 0.9) + P.f, sy - 1.6, "B"); // 이마(멜론)와 주둥이 사이 주름
    ellipse(g, X(P, P.rx * 0.05), P.cy + P.ry * 0.55, P.rx * 0.72, P.ry * 0.4, "w"); // 흰 배
    // 가슴지느러미(배 옆)
    { const fw = (P.wag || 0) * P.ry * 0.4;
      tri(g, [X(P, -P.rx * 0.05), P.cy + P.ry * 0.4], [X(P, -P.rx * 0.5), P.cy + P.ry * 0.8 - fw], [X(P, -P.rx * 0.32), P.cy + P.ry * 0.98 - fw], "B"); }
    put(g, X(P, -P.rx * 0.6), P.cy - P.ry * 0.35, P.spot); put(g, X(P, -P.rx * 0.5), P.cy - P.ry * 0.48, P.spot);
    beachBall(g, X(P, P.rx * 0.38), P.cy - P.ry - 5.4, 4); // 머리와 한 칸 띄움: 통통 튀는 중
    messyTufts(g, P, "b");
  } },
  "sea.adult.B": { name: "통통 물범", desc: "간식 먹고 빵빵해진 배로 바위에서 뒹굴뒹굴", size: [15, 9.5], draw(g, P) {
    tailFlippers(g, P, "L", 1);
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "W", { shade: "L", shadeFrom: 0.6 });
    ellipse(g, X(P, P.rx * 0.05), P.cy + P.ry * 0.42, P.rx * 0.62, P.ry * 0.5, "w"); // 빵빵한 배
    for (const [kx, ky] of [[-0.7, -0.4], [-0.45, -0.72], [-0.15, -0.88], [0.5, -0.75], [-0.85, 0.05], [0.82, -0.3], [-0.6, -0.05]]) put(g, X(P, P.rx * kx), P.cy + P.ry * ky, "L");
    for (const [kx, ky] of [[-0.3, -0.5], [0.25, -0.62]]) { put(g, X(P, P.rx * kx), P.cy + P.ry * ky, P.spot); put(g, X(P, P.rx * kx) + 1, P.cy + P.ry * ky, P.spot); }
    // 배 위에 얹은 짧은 앞지느러미
    for (const s of [-1, 1]) ellipse(g, X(P, s * P.rx * 0.42 + P.rx * 0.05), P.cy + P.ry * 0.62, 2.2, 1.1, "L");
    flippers(g, P, "L", 0.55, 2.2, 1.2);
    whiskers(g, P, "L");
    messyTufts(g, P, "W");
  } },
  "sea.adult.C": { name: "멋쟁이 펭귄", desc: "노란 귀깃에 나비넥타이, 의젓한 바닷가 신사", size: [11, 10.5], draw(g, P) {
    penguinWings(g, P, "B");
    penguinBody(g, P);
    const { fcx, my } = faceAt(P);
    for (const s of [-1, 1]) { // 노란 귀깃(머리 옆)
      ellipse(g, X(P, s * P.rx * 0.8), P.cy - P.ry * 0.38, 1.4, 2.2, "y");
      put(g, X(P, s * P.rx * 0.8), P.cy - P.ry * 0.12, "Y");
    }
    const t = P.spot;
    stampArt(g, [`${t}${t}...${t}${t}`, `${t}${t}${t}k${t}${t}${t}`, `${t}${t}...${t}${t}`], fcx, my + 5); // 나비넥타이(알 무늬 색)
    beak(g, P);
    feet(g, P, "o", 0.42, 2.3);
    messyTufts(g, P, "B");
  } },
  "sea.adult.D": { name: "삐죽머리 펭귄", desc: "삐죽 눈썹깃, 바위를 콩콩 뛰는 장난꾸러기", size: [11.5, 10], draw(g, P) {
    penguinWings(g, P, "B", 1); // 앞날개 번쩍
    penguinBody(g, P);
    const { fcx, eyeY, edx } = faceAt(P);
    // 머리 위 삐죽 깃
    for (const [k, h] of [[-0.35, 1.45], [-0.05, 1.6], [0.25, 1.4]]) tri(g, [X(P, P.rx * k) - 1.4, P.cy - P.ry * 0.85], [X(P, P.rx * k) + 1.4, P.cy - P.ry * 0.85], [X(P, P.rx * k - 0.12), P.cy - P.ry * h], "B");
    // 노란 눈썹깃: 눈 위에서 바깥 위로 뻗음
    for (const s of [-1, 1]) {
      for (let i = 0; i < 5; i++) put(g, fcx + s * (edx - 1 + i), eyeY - 2 - Math.floor(i * 0.7), "y");
      put(g, fcx + s * (edx + 4), eyeY - 5, "Y"); put(g, fcx + s * (edx + 5), eyeY - 5, "Y");
    }
    beak(g, P);
    feet(g, P, "o", 0.42, 2.2);
    put(g, X(P, -P.rx * 0.6), P.cy - P.ry * 0.55, P.spot); put(g, X(P, -P.rx * 0.5), P.cy - P.ry * 0.7, P.spot);
    messyTufts(g, P, "B");
  } },
  "sea.adult.S": { name: "별빛 해달", secret: true, desc: "쓰다듬어 준 손을 꼭 잡는, 금빛 불가사리 해달", size: [12.5, 10.5], draw(g, P) {
    ellipse(g, X(P, -P.rx * 1.0), P.cy + P.ry * 0.62, 5, 1.8, "N"); // 길고 납작한 꼬리
    ellipse(g, P.cx, P.cy, P.rx, P.ry, "n", { shade: "N", shadeFrom: 0.65 });
    const { fcx, my } = faceAt(P);
    ellipse(g, fcx, P.cy + P.ry * 0.02, P.rx * 0.62, P.ry * 0.5, "s"); // 크림색 얼굴 바탕(해달은 얼굴이 밝음)
    for (const s of [-1, 1]) { ellipse(g, X(P, s * P.rx * 0.72), P.cy - P.ry * 0.72, 1.2, 1.1, "n"); put(g, X(P, s * P.rx * 0.72), P.cy - P.ry * 0.72, "N"); } // 동그란 귀
    // 배 위의 금빛 불가사리 + 양손
    const sy = Math.max(my + 4, P.cy + P.ry * 0.6);
    stampArt(g, STARFISH, fcx, sy);
    for (const s of [-1, 1]) ellipse(g, fcx + s * 4, sy + 1, 1.5, 1.2, "N");
    // 털에 반짝이(별빛)
    for (const [kx, ky] of [[-0.78, 0.25], [0.85, 0.1]]) put(g, X(P, P.rx * kx), P.cy + P.ry * ky, "Y");
    stampArt(g, [".Y.", "YwY", ".Y."], X(P, -P.rx * 0.45), P.cy - P.ry * 0.65);
    put(g, X(P, P.rx * 0.4), P.cy - P.ry * 0.7, P.spot);
    feet(g, P, "N", 0.55, 2.2);
  } },
};

// 알: sprites.js egg 와 같은 16x18 글자 그림. 위는 하얀 모래, 아래는 파도 무늬.
// p/g 는 eggSpriteFor 처럼 펫 무늬 색으로 바꿔 칠할 수 있는 거품 점.
export const SEA_EGG = [
  "......kkkk......",
  "....kkwwwwkk....",
  "...kwwwwwwwwk...",
  "..kwwppwwwwwwk..",
  "..kwwppwwwgwwk..",
  ".kwwwwwwwwwwwwk.",
  ".kwbbwwwwbbwwwk.",
  ".kbbbbwwbbbbwbk.",
  "kbbwbbbbbbwbbbbk",
  "kbBbbbBbbbbbBbbk",
  "kBBBbBBBBbBBBBBk",
  "kBBBBBBwBBBBwBBk",
  "kbBBBBwwwBBBBBbk",
  ".kbbBBBBBBBBbbk.",
  ".kbbbbbbbbbbbbk.",
  "..kbbbbbbbbbbk..",
  "...kkbbbbbbkk...",
  ".....kkkkkk.....",
];
