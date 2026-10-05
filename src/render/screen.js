// 방 화면 그리기. 게임 규칙은 모르고 받은 상태만 그린다.
// 캔버스는 "도트 해상도"로 그리고 CSS가 정수배로 키운다.
import { PALETTE } from "./palette.js?v=dff0127-1791181214";
import { SPRITES, drawSprite, spriteSize } from "./sprites.js?v=dff0127-1791181214";
import { buildCreature, paintGrid, formKey, eggSpriteFor } from "./creature.js?v=dff0127-1791181214";
import { drawFace, POOLS } from "./face.js?v=dff0127-1791181214";
import { drawSky } from "./sky.js?v=dff0127-1791181214";

const FLOOR = "#f5b98c";
const FLOOR_LINE = "#e9a274";
const BASEBOARD = "#e8a37e";

export function drawRoom(ctx, { w, h, now, scene, f, wall = Date.now(), loc = { lat: 37.57, lon: 126.98 }, weather = null }) {
  const floorY = Math.round(h * 0.5);

  // 벽 + 작은 무늬
  ctx.fillStyle = PALETTE.c;
  ctx.fillRect(0, 0, w, floorY);
  ctx.fillStyle = "#ffd6bd";
  for (let y = 6; y < floorY - 6; y += 12) {
    for (let x = (y / 12) % 2 ? 10 : 4; x < w; x += 12) ctx.fillRect(x, y, 2, 2);
  }

  // 창문: 실제 시각·위치의 하늘(낮·노을·밤, 해·달·별)
  const win = windowRect(w, floorY);
  const skyInfo = drawWindow(ctx, win, wall, loc, now, 0, weather);

  // 액자: 도감 보상 '추억 액자'가 열리면 가장 최근 함께한 친구 그림(금 액자 보상이면 금색 테두리)
  const memo = scene && scene.memory;
  if (memo) drawMemoryFrame(ctx, Math.round(w * 0.64), Math.round(floorY * 0.2), memo);
  else {
    const fx = Math.round(w * 0.7), fy = Math.round(floorY * 0.36);
    ctx.fillStyle = PALETTE.o; ctx.fillRect(fx, fy, 22, 18);
    ctx.fillStyle = PALETTE.g; ctx.fillRect(fx + 2, fy + 2, 18, 14);
    ctx.fillStyle = PALETTE.G; ctx.fillRect(fx + 4, fy + 9, 6, 7); ctx.fillRect(fx + 11, fy + 6, 6, 10);
  }

  // 걸레받이 + 바닥 나무결
  ctx.fillStyle = BASEBOARD; ctx.fillRect(0, floorY - 3, w, 3);
  ctx.fillStyle = FLOOR; ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = FLOOR_LINE;
  for (let y = floorY + 8; y < h; y += 10) ctx.fillRect(0, y, w, 1);

  // 러그
  const cx = Math.round(w / 2), rugY = Math.round(floorY + (h - floorY) * 0.38);
  const starRug = scene && scene.rug === "star"; // 도감 보상 '별 러그'
  ctx.fillStyle = starRug ? PALETTE.B : PALETTE.P;
  for (let i = -6; i <= 6; i++) {
    const half = Math.round(Math.sqrt(1 - (i / 7) ** 2) * Math.min(40, w * 0.3));
    ctx.fillRect(cx - half, rugY + i, half * 2, 1);
  }
  ctx.fillStyle = starRug ? "#3d4f9a" : PALETTE.p;
  for (let i = -4; i <= 4; i++) {
    const half = Math.round(Math.sqrt(1 - (i / 5) ** 2) * Math.min(32, w * 0.24));
    ctx.fillRect(cx - half, rugY + i, half * 2, 1);
  }
  if (starRug) {
    ctx.fillStyle = PALETTE.y;
    for (const [sx, sy] of [[-24, -2], [-12, 2], [-2, -3], [9, 1], [20, -2], [28, 2], [-30, 1], [2, 3]]) { ctx.fillRect(cx + sx, rugY + sy, 1, 1); if ((sx + sy) % 2 === 0) { ctx.fillRect(cx + sx - 1, rugY + sy, 3, 1); ctx.fillRect(cx + sx, rugY + sy - 1, 1, 3); } }
    ctx.fillStyle = PALETTE.w; ctx.fillRect(cx + 14, rugY - 3, 2, 2); ctx.fillRect(cx + 15, rugY - 3, 1, 1); // 작은 달
  }

  const sc = scene || { stage: "egg" };
  const fr = f || { pose: { dx: 0, dy: 0, sx: 1, sy: 1, eyes: null, mouth: null, facing: 1 }, props: [], texts: [], fx: [], darkness: sc.lightOn === false ? 0.62 : sc.asleep ? 0.18 : 0, flash: 0 };
  const baseY = rugY + 4;
  const poopRects = drawPoops(ctx, sc.poopSlots || [], { cx, rugY, w, pop: fr.poopPop || 0 });
  const box = fr.hidePet ? null : drawPet(ctx, sc, fr, { cx, baseY, now });
  const px = cx + Math.round(fr.pose.dx);
  for (const pr of fr.props) {
    const sp = SPRITES[pr.sprite]; if (!sp || pr.alpha <= 0) continue;
    const { w: sw, h: sh } = spriteSize(sp);
    ctx.globalAlpha = Math.min(1, pr.alpha);
    const ex = pr.edge && box ? Math.sign(pr.edge) * (box.w / 2 + (sw * pr.scale) / 2) : 0; // edge: 펫 몸 옆에 붙여 그리기
    drawSprite(ctx, sp, Math.round(px + ex + pr.x - (sw * pr.scale) / 2), Math.round(baseY + pr.y - sh * pr.scale), pr.scale);
    ctx.globalAlpha = 1;
  }
  for (const o of fr.gameObjs || []) { // 놀이 물체(절대 좌표, x 가운데·y 바닥)
    if (o.text) { ctx.fillStyle = PALETTE.k; ctx.font = `bold ${o.size || 9}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText(o.text, Math.round(o.x), Math.round(o.y)); continue; }
    const sp = SPRITES[o.sprite]; if (!sp || o.alpha <= 0) continue;
    const { w: sw, h: sh } = spriteSize(sp);
    ctx.globalAlpha = Math.min(1, o.alpha ?? 1);
    drawSprite(ctx, sp, Math.round(o.x - (sw * o.scale) / 2), Math.round(o.y - sh * o.scale), o.scale);
    ctx.globalAlpha = 1;
  }
  for (const fx of fr.fx || []) drawFx(ctx, fx);
  if (fr.darkness > 0) {
    // 방을 어둡게 하되 창문 자리만 덜 어둡게(창밖 달빛·별이 보이게). 창문을 다시 그리면 펫 위에 덮여서 안 됨
    ctx.fillStyle = `rgba(20,16,60,${fr.darkness})`;
    ctx.fillRect(0, 0, w, win.y); ctx.fillRect(0, win.y + win.h, w, h - win.y - win.h);
    ctx.fillRect(0, win.y, win.x, win.h); ctx.fillRect(win.x + win.w, win.y, w - win.x - win.w, win.h);
    ctx.fillStyle = `rgba(20,16,60,${fr.darkness * 0.3})`; ctx.fillRect(win.x, win.y, win.w, win.h);
  }
  for (const t of fr.texts) {
    if (t.alpha <= 0) continue;
    ctx.globalAlpha = Math.min(1, t.alpha);
    ctx.fillStyle = t.color || (fr.darkness > 0.3 ? "#fff7ec" : PALETTE.k);
    ctx.font = `bold ${Math.round(t.size)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(t.text, Math.round((t.abs ? cx : px) + t.x), Math.round(baseY + t.y));
    ctx.globalAlpha = 1;
  }
  if (fr.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${fr.flash})`; ctx.fillRect(0, 0, w, h); }
  return { pet: box, poops: poopRects, window: win, sky: skyInfo, memo: memo ? { x: Math.round(w * 0.64), y: Math.round(floorY * 0.2), w: 36, h: 34 } : null, layout: { w, h, cx, baseY, headY: box ? box.y + 4 : baseY - 30 } };
}

function windowRect(w, floorY) {
  const ww = Math.min(56, Math.round(w * 0.42)), wh = Math.round(ww * 0.72);
  return { x: Math.round(w * 0.08), y: Math.round(floorY * 0.24), w: ww, h: wh };
}

function drawWindow(ctx, r, wall, loc, now, dim, weather) {
  ctx.fillStyle = PALETTE.N; ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); // 창틀
  const info = drawSky(ctx, r, wall, loc, now, weather);
  if (dim > 0) { ctx.fillStyle = `rgba(20,16,60,${dim})`; ctx.fillRect(r.x, r.y, r.w, r.h); }
  ctx.fillStyle = PALETTE.N;
  ctx.fillRect(r.x + Math.round(r.w / 2) - 1, r.y, 2, r.h); ctx.fillRect(r.x, r.y + Math.round(r.h / 2) - 1, r.w, 2);
  // 창턱
  ctx.fillStyle = PALETTE.n; ctx.fillRect(r.x - 4, r.y + r.h + 2, r.w + 8, 3);
  if (info.snowy) { ctx.fillStyle = "#f4f7ff"; ctx.fillRect(r.x - 4, r.y + r.h + 1, r.w + 8, 2); } // 창턱에 쌓인 눈
  if (weather && ["rain", "thunder", "drizzle"].includes(weather.kind)) { ctx.fillStyle = "rgba(140,180,230,0.8)"; for (let i = 0; i < 4; i++) if ((Math.floor(now / 300) + i) % 3 === 0) ctx.fillRect(r.x + 4 + i * Math.round(r.w / 4), r.y + r.h + 1, 2, 1); } // 창턱에 튀는 빗방울
  return info;
}

const POOP_SPRITE = [
  "...NN..",
  "..NnnN.",
  ".NnnnnN",
  "NnnnnnN",
  ".NNNNN.",
];

export const POOP_SPOTS = [[-38, -2], [34, 2], [-24, 12], [44, 13]];
function drawPoops(ctx, slots, { cx, rugY, w, pop = 0 }) {
  const rects = [];
  slots.forEach((slot, i) => {
    const [dx, dy] = POOP_SPOTS[slot] || POOP_SPOTS[0];
    const lift = i === slots.length - 1 ? Math.round(pop * 3) : 0;
    const x = Math.round(cx + dx * Math.min(1, w / 140)), y = rugY + dy - lift;
    drawSprite(ctx, POOP_SPRITE, x, y, 2);
    rects.push({ slot, x, y, w: 14, h: 10 });
  });
  return rects;
}

function drawFx(ctx, fx) {
  if (fx.type === "shootingStar") { // 창문 안을 가로지르는 별똥별(fx.x,y = 창문 왼쪽 위, w,h = 크기)
    const r = fx.rect; if (!r) return;
    const k = fx.t;
    const sx = r.x + r.w * (0.95 - k * 0.9), sy = r.y + r.h * (0.12 + k * 0.5);
    ctx.save(); ctx.beginPath(); ctx.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); ctx.clip();
    for (let i = 0; i < 10; i++) { ctx.globalAlpha = (1 - i / 10) * (1 - Math.max(0, k - 0.8) * 5); ctx.fillStyle = i < 2 ? PALETTE.w : PALETTE.y; ctx.fillRect(Math.round(sx + i * 2), Math.round(sy - i * 1.1), 2, 1); }
    ctx.restore(); ctx.globalAlpha = 1;
    return;
  }
  if (fx.type === "poof") {
    const k = fx.t, r = 3 + k * 9;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = PALETTE.w;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.fillRect(Math.round(fx.x + Math.cos(a) * r) - 2, Math.round(fx.y + Math.sin(a) * r * 0.7) - 2, 4, 4); }
    ctx.fillStyle = PALETTE.s; ctx.fillRect(Math.round(fx.x) - 2, Math.round(fx.y - k * 6) - 2, 4, 4);
    if (k > 0.3) drawSprite(ctx, SPRITES.sparkle, Math.round(fx.x - 5), Math.round(fx.y - 14 - k * 8), 2);
    ctx.globalAlpha = 1;
  }
}

// 추억 액자: 최근 함께한 친구 초상화(1칸=1px), 캐시해서 매 프레임 다시 만들지 않음
const MEMO_CACHE = { key: "", canvas: null };
function drawMemoryFrame(ctx, fx, fy, memo) {
  const W = 36, H = 34;
  ctx.fillStyle = PALETTE.k; ctx.fillRect(fx - 1, fy - 1, W + 2, H + 2);
  ctx.fillStyle = memo.gold ? PALETTE.Y : PALETTE.o; ctx.fillRect(fx, fy, W, H);
  if (memo.gold) { ctx.fillStyle = PALETTE.y; ctx.fillRect(fx, fy, W, 1); ctx.fillRect(fx, fy, 1, H); }
  ctx.fillStyle = "#fff4e3"; ctx.fillRect(fx + 2, fy + 2, W - 4, H - 4);
  const ck = `${memo.key}|${JSON.stringify(memo.look)}`;
  if (MEMO_CACHE.key !== ck && typeof document !== "undefined") {
    const b = buildCreature(memo.key, { look: memo.look || {} });
    if (b) {
      drawFace(b.g, b.P, POOLS.great[1]);
      const c = document.createElement("canvas"); c.width = 76; c.height = 50;
      const cx2 = c.getContext("2d"); paintGrid(cx2, b.g, 38, 48, 1);
      MEMO_CACHE.key = ck; MEMO_CACHE.canvas = c;
    }
  }
  if (MEMO_CACHE.key === ck && MEMO_CACHE.canvas) {
    // 그림을 액자 안쪽에 맞춰(정수배 축소 없이 가운데 잘라) 넣는다
    const iw = W - 4, ih = H - 4;
    ctx.save(); ctx.beginPath(); ctx.rect(fx + 2, fy + 2, iw, ih); ctx.clip();
    ctx.drawImage(MEMO_CACHE.canvas, 38 - iw / 2, 49 - ih, iw, ih, fx + 2, fy + 2, iw, ih); // 1:1, 발이 액자 아래쪽
    ctx.restore();
  }
  ctx.fillStyle = PALETTE.k; ctx.fillRect(fx + W / 2 - 1, fy - 5, 2, 4); // 거는 끈
}

function eggSprite(scene) {
  return eggSpriteFor(SPRITES, scene.theme, scene.look);
}

function drawEgg(ctx, cx, baseY, now, egg, scene) {
  const sp = eggSprite(scene), { w: ew, h: eh } = spriteSize(sp);
  const k = Math.floor(now / 250) % 8;
  const idle = k === 0 ? -1 : k === 1 ? 1 : 0;
  const shake = egg ? Math.round(egg.shake) : idle;
  const x = cx - ew + shake * 2, y = baseY - eh * 2;
  drawSprite(ctx, sp, x, y, 2);
  if (egg && egg.cracks) {
    ctx.fillStyle = PALETTE.k;
    const zig = [[4, 0], [5, 1], [6, 0], [7, 1], [8, 2], [9, 1], [10, 2], [11, 1]];
    for (let c = 0; c < egg.cracks; c++) {
      const yy = y + (6 + c * 3) * 2;
      for (const [zx, zy] of zig) ctx.fillRect(x + zx * 2 + c * 2, yy + zy * 2, 2, 2);
    }
  }
  return { x, y, w: ew * 2, h: eh * 2 };
}

const CELL = 2; // 캐릭터 도트 한 칸 = 논리 px 2

// 잘 때 쿠션: 톡 커지며 나타남(bed 0→1)
function drawCushion(ctx, x, baseY, bodyW, bed, theme) {
  const k = Math.min(1, bed * 1.6);
  const W = Math.round((bodyW + 16) * (0.6 + 0.4 * k)), H = 8;
  const left = Math.round(x - W / 2), top = baseY - H + 2;
  const [c1, c2] = theme === "fantasy" ? [PALETTE.y, PALETTE.Y] : [PALETTE.v, PALETTE.V];
  ctx.globalAlpha = k;
  ctx.fillStyle = PALETTE.k; ctx.fillRect(left + 2, top - 1, W - 4, H + 2); ctx.fillRect(left, top + 1, W, H - 2);
  ctx.fillStyle = c2; ctx.fillRect(left + 2, top, W - 4, H); ctx.fillRect(left + 1, top + 2, W - 2, H - 4);
  ctx.fillStyle = c1; ctx.fillRect(left + 2, top, W - 4, H - 3); ctx.fillRect(left + 1, top + 2, W - 2, H - 6);
  ctx.fillStyle = PALETTE.w; ctx.fillRect(left + 4, top + 1, Math.round(W * 0.3), 1); // 반짝
  ctx.fillStyle = c2; for (const fx of [0.25, 0.5, 0.75]) ctx.fillRect(Math.round(left + W * fx) - 1, top + 3, 2, 2); // 단추
  ctx.globalAlpha = 1;
}

const CACHE = new Map(); // 같은 모습은 다시 계산하지 않기 위한 캐시

// ---------- 밤잠 이불 ----------
// 쿠션 위에 앉은 펫의 몸 아래쪽을 앞에서 덮는다(입 아래까지, 얼굴은 보임). 숨 쉴 때 가장자리가 살짝 물결침.
// 이불 색: 테마 기본색, 몸 색과 겹치면 다른 색(파란 몸에 하늘색 이불이면 안 보이므로)
function blanketColors(theme, built) {
  if (theme !== "fantasy") return [PALETTE.p, PALETTE.P, PALETTE.w];
  const body = built ? built.g.c[Math.round(built.P.cy) * built.g.w + Math.round(built.P.cx - built.P.rx * 0.75)] : null;
  return ["b", "B"].includes(body) ? [PALETTE.v, PALETTE.V, PALETTE.y] : [PALETTE.b, PALETTE.B, PALETTE.y];
}

function drawBlanket(ctx, x, base, box, P, bodyW, k, now, theme, built) {
  const W = bodyW + 8;
  const left = Math.round(x - W / 2);
  const bottom = base + 3;
  const mouthBottom = P.cy - P.ry * 0.12 + Math.max(3, Math.round(P.ry * 0.32)) + 2; // 얼굴(입)까지는 보이게
  const targetTop = box.oy + Math.round(Math.max(mouthBottom, P.cy + P.ry * 0.3) * CELL);
  const top = Math.round(bottom - (bottom - targetTop) * k);
  if (bottom - top < 2) return;
  const [c1, c2, dot] = blanketColors(theme, built);
  for (let xx = 0; xx < W; xx++) {
    const wave = Math.round(Math.sin(xx / 4 + now / 700) * 0.8);
    const edge = xx === 0 || xx === W - 1 ? 2 : xx === 1 || xx === W - 2 ? 1 : 0; // 둥근 모서리
    const yTop = top + wave + edge;
    const px = left + xx;
    ctx.fillStyle = PALETTE.k; ctx.fillRect(px, yTop - 1, 1, 1); // 윗선
    ctx.fillStyle = PALETTE.w; ctx.fillRect(px, yTop, 1, 2); // 접힌 깃
    ctx.fillStyle = c1; ctx.fillRect(px, yTop + 2, 1, Math.max(0, bottom - yTop - 2));
    if (xx === 0 || xx === W - 1) { ctx.fillStyle = PALETTE.k; ctx.fillRect(px, yTop, 1, bottom - yTop); }
  }
  ctx.fillStyle = c2; ctx.fillRect(left + 1, bottom - 2, W - 2, 2); // 아래 그림자
  // 무늬(동물: 흰 땡땡이, 상상: 노란 별)
  ctx.fillStyle = dot;
  for (let yy = top + 5; yy < bottom - 3; yy += 5) for (let xx = left + 3 + ((yy / 5) % 2) * 3; xx < left + W - 3; xx += 6) {
    ctx.fillRect(xx, yy, 2, 1); ctx.fillRect(xx, yy, 1, 2);
  }
}

// ---------- 엉덩이춤: 앞모습으로 뒷모습 만들기 ----------
// 얼굴은 안 그리고, 몸 안쪽의 흰 무늬(볼·배)와 분홍 볼을 몸 색으로 덮는다
function toBackView(g) {
  const cnt = {};
  for (const c of g.c) if (c && c !== "k" && c !== "w") cnt[c] = (cnt[c] || 0) + 1;
  const main = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] || "w";
  const W = g.w, src = g.c.slice();
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (!c || c === "k" || c === main) continue;
    // 테두리에 붙은 칸(귀 안쪽·뿔·날개 끝 등 바깥 무늬)은 두고, 몸 안쪽 무늬(볼·배·점)만 덮는다
    const x = i % W;
    const nb = [i - 1, i + 1, i - W, i + W].filter((j) => j >= 0 && j < src.length && Math.abs((j % W) - x) <= 1);
    if (nb.length === 4 && nb.every((j) => src[j] && src[j] !== "k")) g.c[i] = main;
  }
  g.backColor = main;
}
// 동그랗고 복슬한 꼬리(몸 색 + 흰 끝) + 엉덩이 골
const SHADE = { o: "O", p: "P", b: "B", g: "G", v: "V", y: "Y", w: "s", n: "k", c: "S" };
function drawTail(ctx, x, base, built, wag) {
  const bc = built.g.backColor || "o";
  const col = PALETTE[bc] || PALETTE.o, sh = PALETTE[SHADE[bc] || "k"] || PALETTE.k;
  const tx = Math.round(x + wag * 5), ty = base - 9;
  const rows = [3, 5, 6, 6, 6, 5, 3]; // 반지름 모양(가로 반폭)
  rows.forEach((hw, r) => { ctx.fillStyle = PALETTE.k; ctx.fillRect(tx - hw - 1, ty - 3 + r, hw * 2 + 2, 1); });
  ctx.fillStyle = PALETTE.k; ctx.fillRect(tx - 3, ty - 4, 6, 1); ctx.fillRect(tx - 3, ty + 4, 6, 1);
  rows.forEach((hw, r) => { ctx.fillStyle = col; ctx.fillRect(tx - hw, ty - 3 + r, hw * 2, 1); });
  ctx.fillStyle = sh; ctx.fillRect(tx - 3, ty + 2, 7, 1); ctx.fillRect(tx + 3, ty - 1, 2, 3); // 아래·오른쪽 그늘
  ctx.fillStyle = PALETTE.w; ctx.fillRect(tx - 3, ty - 2, 3, 2); ctx.fillRect(tx - 2, ty, 1, 1); // 복슬한 흰 끝
  ctx.fillStyle = PALETTE.k; ctx.fillRect(Math.round(x), base - 3, 1, 3); // 엉덩이 골
}
function drawHat(ctx, box, hat, P, facing) {
  const sp = SPRITES[hat]; if (!sp) return;
  const { w: sw, h: sh } = spriteSize(sp);
  const sc = hat === "heartClip" ? 1 : 2;
  const hx = hat === "heartClip" ? Math.round(box.x + box.w * (facing >= 0 ? 0.72 : 0.18)) : Math.round(box.x + box.w / 2 - (sw * sc) / 2);
  const hy = Math.round(box.y - sh * sc + (hat === "heartClip" ? sh : 6));
  drawSprite(ctx, sp, hx, hy, sc);
}

// ---------- 씻기: 욕조와 거품 ----------
function drawTub(ctx, x, base, box, P, bodyW, k, now) {
  const W = bodyW + 16, left = Math.round(x - W / 2);
  const bottom = base + 4;
  const mouthBottom = P.cy - P.ry * 0.12 + Math.max(3, Math.round(P.ry * 0.32)) + 2.5; // 얼굴(입)은 보이게
  const rim = box.oy + Math.round(Math.max(mouthBottom, P.cy + P.ry * 0.35) * CELL) + 3;
  const top = Math.round(bottom - (bottom - rim) * k); // 아래에서 쏙 올라옴
  if (bottom - top < 3) return;
  // 물 + 거품 줄(테두리 위)
  for (let xx = 2; xx < W - 2; xx += 3) {
    const by = top - 2 - Math.round(Math.abs(Math.sin(xx * 1.7 + now / 260)) * 2);
    ctx.fillStyle = PALETTE.k; ctx.fillRect(left + xx - 1, by - 1, 4, 4);
    ctx.fillStyle = PALETTE.w; ctx.fillRect(left + xx, by, 3, 3);
  }
  // 욕조 몸통
  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(left, top, W, bottom - top + 1); ctx.fillRect(left + 2, bottom, W - 4, 2);
  ctx.fillStyle = PALETTE.w; ctx.fillRect(left + 1, top + 1, W - 2, bottom - top - 1);
  ctx.fillStyle = PALETTE.b; ctx.fillRect(left + 1, top + 1, W - 2, 2); // 물빛 테두리
  ctx.fillStyle = PALETTE.s; ctx.fillRect(left + 1, bottom - 3, W - 2, 3); // 아래 그늘
  ctx.fillStyle = PALETTE.k; ctx.fillRect(left + 1, top + 3, W - 2, 1);
  // 하트 무늬, 다리
  ctx.fillStyle = PALETTE.p;
  for (let xx = left + 6; xx < left + W - 6; xx += 10) { const y = top + Math.max(5, Math.round((bottom - top) / 2)); ctx.fillRect(xx, y, 1, 1); ctx.fillRect(xx + 2, y, 1, 1); ctx.fillRect(xx, y + 1, 3, 1); ctx.fillRect(xx + 1, y + 2, 1, 1); }
  ctx.fillStyle = PALETTE.k; for (const fx of [left + 3, left + W - 6]) ctx.fillRect(fx, bottom + 1, 3, 3);
  ctx.fillStyle = PALETTE.Y; for (const fx of [left + 4, left + W - 5]) ctx.fillRect(fx, bottom + 1, 1, 2);
  // 고무 오리(오른쪽 가장자리에서 동동)
  if (k > 0.8) drawSprite(ctx, SPRITES.duck, left + W - 18, top - 15 + Math.round(Math.sin(now / 300) * 1.5), 2);
}

function drawFoam(ctx, box, k, now) {
  // 동그란 거품 덩어리 여러 개를 머리 위에 몽글몽글
  const n = Math.max(3, Math.round(box.w / 8));
  const blob = (cx, cy, r) => {
    for (const [col, rr] of [[PALETTE.k, r + 1], [PALETTE.w, r]]) {
      ctx.fillStyle = col;
      for (let dy = -rr; dy <= rr; dy++) { const half = Math.round(Math.sqrt(Math.max(0, rr * rr - dy * dy + rr * 0.6))); ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1); }
    }
    ctx.fillStyle = PALETTE.b; ctx.fillRect(cx - Math.round(r / 2), cy - Math.round(r / 2), 1, 1); // 반짝
  };
  const pts = [];
  for (let i = 0; i < n; i++) {
    const r = Math.round((2.5 + ((i * 5) % 3) * 0.8) * k);
    if (r < 2) continue;
    pts.push([Math.round(box.x + 5 + (i + 0.5) * ((box.w - 10) / n)), Math.round(box.y + 4 - Math.abs(Math.sin(i * 2.1)) * 3 * k + Math.sin(now / 300 + i) * 0.6), r]);
  }
  for (const [x, y, r] of pts) { ctx.fillStyle = PALETTE.k; for (let dy = -r - 1; dy <= r + 1; dy++) { const h = Math.round(Math.sqrt(Math.max(0, (r + 1) ** 2 - dy * dy + r * 0.6))); ctx.fillRect(x - h, y + dy, h * 2 + 1, 1); } }
  for (const [x, y, r] of pts) { ctx.fillStyle = PALETTE.w; for (let dy = -r; dy <= r; dy++) { const h = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy + r * 0.6))); ctx.fillRect(x - h, y + dy, h * 2 + 1, 1); } ctx.fillStyle = PALETTE.b; ctx.fillRect(x - Math.round(r / 2), y - Math.round(r / 2), 1, 1); }
  // 꼭대기 작은 방울 하나
  if (k > 0.6 && pts.length) { const [x, y, r] = pts[Math.floor(pts.length / 2)]; blob(x + 2, y - r - 3, 2); }
}

function drawPet(ctx, scene, fr, { cx, baseY, now }) {
  const pose = fr.pose;
  const key = fr.showKey || formKey(scene.theme || "animal", scene.stage, scene.branch);
  if (key.endsWith(".egg")) return drawEgg(ctx, cx, baseY, now, fr.egg, scene);
  // 같은 모습은 다시 계산하지 않는다(숨쉬기처럼 미세한 늘어남은 0.02 단위로 묶음)
  const q = (v) => Math.round(v * 50) / 50;
  const look = scene.look || {}, fc = scene.face || {};
  const ck = [key, q(pose.sx), q(pose.sy), pose.facing >= 0 ? 1 : -1, look.spot, look.chub, look.messy ? 1 : 0, fr.silhouette ? 1 : 0, fr.back ? 1 : 0, fr.wag != null ? Math.round(fr.wag * 4) : 0, pose.eyes, pose.mouth, fc.L, fc.R, fc.m, (fc.ex || []).join(","), fc.dy || 0, fc.look || 0, scene.theme].join("|");
  let cached = CACHE.get(ck);
  if (!cached) {
    const built = buildCreature(key, { sx: q(pose.sx), sy: q(pose.sy), facing: pose.facing, look, silhouette: fr.silhouette ? "w" : null, wag: fr.wag != null ? Math.round(fr.wag * 4) / 4 : 0 });
    if (!built) return null;
    if (fr.back && !fr.silhouette) toBackView(built.g);
    const faceInfo = fr.silhouette || fr.back ? null : drawFace(built.g, built.P, scene.face, { eyes: pose.eyes, mouth: pose.mouth });
    cached = { built, faceInfo };
    CACHE.set(ck, cached);
    if (CACHE.size > 80) CACHE.delete(CACHE.keys().next().value);
  }
  const { built, faceInfo } = cached;
  const bed = fr.silhouette ? 0 : fr.bed || 0;
  const bodyW = Math.round(built.P.rx * 2 * CELL);
  const x = cx + Math.round(pose.dx);
  if (bed > 0) drawCushion(ctx, x, baseY, bodyW, bed, scene.theme);
  const lift = Math.round(5 * Math.min(1, bed * 1.6)); // 쿠션 위에 올라앉음
  const base = baseY + Math.round(pose.dy) - lift;
  // 그림자 (높이 뛸수록 작아짐)
  if (bed <= 0) {
    ctx.fillStyle = "rgba(59,44,53,0.18)";
    const shw = Math.round(bodyW * (1 - Math.min(0.5, -pose.dy / 30)));
    ctx.fillRect(Math.round(cx + pose.dx - shw / 2), baseY - 1, shw, 3);
  }
  const box = paintGrid(ctx, built.g, x, base, CELL, { alpha: fr.petAlpha ?? 1, tint: scene.sick && !fr.silhouette ? "rgba(150,210,150,0.22)" : null });
  if (fr.back && !fr.silhouette) { // 엉덩이춤: 꼬리 없는 그림엔 복슬 꼬리, 용처럼 꼬리가 그려진 친구는 엉덩이 골만
    if (fr.tailKind === "own") { ctx.fillStyle = PALETTE.k; ctx.fillRect(Math.round(x), base - 3, 1, 3); }
    else drawTail(ctx, x, base, built, fr.tailWag || 0);
  }
  if (fr.hat && !fr.silhouette && box) drawHat(ctx, box, fr.hat, built.P, pose.facing);
  const blanketK = fr.silhouette ? 0 : fr.blanket || 0; // 밤잠 이불(0 → 1): 아래에서 올라와 몸 아래쪽을 덮음
  if (blanketK > 0) drawBlanket(ctx, x, base, box, built.P, bodyW, blanketK, now, scene.theme, built);
  if (!fr.silhouette && (fr.foam || 0) > 0) drawFoam(ctx, box, fr.foam, now); // 머리 위 거품
  if (!fr.silhouette && (fr.tub || 0) > 0) drawTub(ctx, x, base, box, built.P, bodyW, fr.tub, now); // 욕조(몸 아래쪽 앞)

  if (faceInfo) {
    // 눈물
    if (pose.tears) {
      ctx.fillStyle = PALETTE.b;
      faceInfo.eyes.forEach(([ex, ey], i) => {
        const ph = ((now / 700) + i * 0.5) % 1;
        ctx.fillRect(box.ox + ex * CELL, box.oy + (ey + 2) * CELL + Math.round(ph * built.P.ry * CELL * 0.8), CELL, CELL * 2);
      });
    }
    // 음표·물음표
    faceInfo.texts.forEach((t, i) => {
      ctx.fillStyle = PALETTE.k; ctx.font = "bold 9px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(t, box.x + box.w + 2 + i * 8, box.y + 6 + Math.sin(now / 300) * 2);
    });
  }
  // 어지러움(아플 때): 머리 위를 도는 별
  if (pose.dizzy) {
    for (let i = 0; i < 3; i++) {
      const ang = now / 260 + (i * Math.PI * 2) / 3;
      drawSprite(ctx, SPRITES.sparkle, Math.round(box.x + box.w / 2 + Math.cos(ang) * box.w * 0.4) - 2, Math.round(box.y - 6 + Math.sin(ang) * 4) - 2, 1);
    }
  }
  return box;
}

export function drawIcon(canvas, sprite, scale = 3) {
  const { w, h } = spriteSize(sprite);
  canvas.width = 10 * scale; canvas.height = 8 * scale;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSprite(ctx, sprite, ((10 - w) * scale) / 2, ((8 - h) * scale) / 2, scale);
}
