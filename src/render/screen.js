// 방 화면 그리기. 게임 규칙은 모르고 받은 상태만 그린다.
// 캔버스는 "도트 해상도"로 그리고 CSS가 정수배로 키운다.
import { PALETTE } from "./palette.js?v=0a4f52f-1791114689";
import { SPRITES, drawSprite, spriteSize } from "./sprites.js?v=0a4f52f-1791114689";

const FLOOR = "#f5b98c";
const FLOOR_LINE = "#e9a274";
const BASEBOARD = "#e8a37e";

export function drawRoom(ctx, { w, h, now, scene }) {
  const floorY = Math.round(h * 0.5);

  // 벽 + 작은 무늬
  ctx.fillStyle = PALETTE.c;
  ctx.fillRect(0, 0, w, floorY);
  ctx.fillStyle = "#ffd6bd";
  for (let y = 6; y < floorY - 6; y += 12) {
    for (let x = (y / 12) % 2 ? 10 : 4; x < w; x += 12) ctx.fillRect(x, y, 2, 2);
  }

  // 창문(하늘 + 구름)
  const winW = Math.min(48, Math.round(w * 0.38)), winH = Math.round(winW * 0.75);
  const winX = Math.round(w * 0.1), winY = Math.round(floorY * 0.3);
  ctx.fillStyle = PALETTE.N; ctx.fillRect(winX - 2, winY - 2, winW + 4, winH + 4);
  ctx.fillStyle = PALETTE.b; ctx.fillRect(winX, winY, winW, winH);
  ctx.fillStyle = PALETTE.w;
  const cloudX = winX + ((Math.floor(now / 400) % (winW + 20)) - 10);
  ctx.save(); ctx.beginPath(); ctx.rect(winX, winY, winW, winH); ctx.clip();
  ctx.fillRect(cloudX, winY + 8, 12, 4); ctx.fillRect(cloudX + 3, winY + 5, 6, 3);
  ctx.restore();
  ctx.fillStyle = PALETTE.N;
  ctx.fillRect(winX + Math.round(winW / 2) - 1, winY, 2, winH); ctx.fillRect(winX, winY + Math.round(winH / 2) - 1, winW, 2);

  // 액자
  const fx = Math.round(w * 0.66), fy = Math.round(floorY * 0.38);
  ctx.fillStyle = PALETTE.o; ctx.fillRect(fx, fy, 22, 18);
  ctx.fillStyle = PALETTE.g; ctx.fillRect(fx + 2, fy + 2, 18, 14);
  ctx.fillStyle = PALETTE.G; ctx.fillRect(fx + 4, fy + 9, 6, 7); ctx.fillRect(fx + 11, fy + 6, 6, 10);

  // 걸레받이 + 바닥 나무결
  ctx.fillStyle = BASEBOARD; ctx.fillRect(0, floorY - 3, w, 3);
  ctx.fillStyle = FLOOR; ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = FLOOR_LINE;
  for (let y = floorY + 8; y < h; y += 10) ctx.fillRect(0, y, w, 1);

  // 러그
  const cx = Math.round(w / 2), rugY = Math.round(floorY + (h - floorY) * 0.38);
  ctx.fillStyle = PALETTE.P;
  for (let i = -6; i <= 6; i++) {
    const half = Math.round(Math.sqrt(1 - (i / 7) ** 2) * Math.min(40, w * 0.3));
    ctx.fillRect(cx - half, rugY + i, half * 2, 1);
  }
  ctx.fillStyle = PALETTE.p;
  for (let i = -4; i <= 4; i++) {
    const half = Math.round(Math.sqrt(1 - (i / 5) ** 2) * Math.min(32, w * 0.24));
    ctx.fillRect(cx - half, rugY + i, half * 2, 1);
  }

  drawPet(ctx, scene || { stage: "egg" }, { cx, baseY: rugY + 4, now });
  if (scene && scene.poops) drawPoops(ctx, scene.poops, { cx, rugY, w });
  if (scene && scene.asleep) {
    ctx.fillStyle = scene.lightOn ? "rgba(40,30,80,0.18)" : "rgba(20,16,60,0.62)";
    ctx.fillRect(0, 0, w, h);
  }
}

const POOP_SPRITE = [
  "...NN..",
  "..NnnN.",
  ".NnnnnN",
  "NnnnnnN",
  ".NNNNN.",
];

function drawPoops(ctx, n, { cx, rugY, w }) {
  const spots = [[-34, -2], [30, 2], [-22, 10], [40, 12]];
  for (let i = 0; i < n; i++) {
    const [dx, dy] = spots[i];
    drawSprite(ctx, POOP_SPRITE, Math.round(cx + dx * Math.min(1, w / 140)), rugY + dy, 2);
  }
}

// M2 시제품: 단계별 크기만 다른 네모 캐릭터(최종 도트는 M3)
const BODY = { animal: ["#ffb3c4", "#e86a8a"], fantasy: ["#c9b6ff", "#8f74e6"] };
const SIZE = { baby: 14, child: 18, teen: 22, adult: 26 };

function drawPet(ctx, scene, { cx, baseY, now }) {
  if (scene.stage === "egg") {
    const egg = SPRITES.egg, { w: ew, h: eh } = spriteSize(egg);
    const k = Math.floor(now / 250) % 8;
    const wobble = k === 0 ? -1 : k === 1 ? 1 : 0;
    drawSprite(ctx, egg, cx - ew + wobble * 2, baseY - eh * 2, 2);
    return;
  }
  const [fill, edge] = BODY[scene.theme] || BODY.animal;
  const size = SIZE[scene.stage] || 18;
  const s = 2; // 도트 배율
  const bob = scene.asleep || scene.napping ? 0 : (Math.floor(now / 500) % 2);
  const W = size, H = size - 2;
  const x0 = Math.round(cx - (W * s) / 2), y0 = Math.round(baseY - H * s - bob * s);
  // 몸
  ctx.fillStyle = PALETTE.k; ctx.fillRect(x0 + s, y0, (W - 2) * s, H * s); ctx.fillRect(x0, y0 + s, W * s, (H - 2) * s);
  ctx.fillStyle = edge; ctx.fillRect(x0 + 2 * s, y0 + s, (W - 4) * s, (H - 2) * s); ctx.fillRect(x0 + s, y0 + 2 * s, (W - 2) * s, (H - 4) * s);
  ctx.fillStyle = fill; ctx.fillRect(x0 + 2 * s, y0 + s, (W - 4) * s, (H - 4) * s); ctx.fillRect(x0 + s, y0 + 2 * s, (W - 2) * s, (H - 6) * s);
  if (scene.sick) { ctx.fillStyle = "rgba(120,200,120,0.35)"; ctx.fillRect(x0 + s, y0 + s, (W - 2) * s, (H - 2) * s); }
  // 얼굴
  const ex = Math.round(W * 0.28), ey = Math.round(H * 0.38);
  ctx.fillStyle = PALETTE.k;
  if (scene.asleep || scene.napping) {
    ctx.fillRect(x0 + ex * s, y0 + ey * s, 2 * s, s); ctx.fillRect(x0 + (W - ex - 2) * s, y0 + ey * s, 2 * s, s);
    ctx.font = "bold 10px system-ui"; ctx.fillText("z", x0 + W * s + 2, y0 + 6);
  } else {
    ctx.fillRect(x0 + ex * s, y0 + (ey - 1) * s, s, 2 * s); ctx.fillRect(x0 + (W - ex - 1) * s, y0 + (ey - 1) * s, s, 2 * s);
  }
  const my = ey + 3, mx = Math.round(W / 2) - 1;
  if (scene.mood >= 50) { ctx.fillRect(x0 + (mx - 1) * s, y0 + my * s, s, s); ctx.fillRect(x0 + mx * s, y0 + (my + 1) * s, 2 * s, s); ctx.fillRect(x0 + (mx + 2) * s, y0 + my * s, s, s); }
  else if (scene.mood >= 20) { ctx.fillRect(x0 + mx * s, y0 + my * s, 2 * s, s); }
  else { ctx.fillRect(x0 + (mx - 1) * s, y0 + (my + 1) * s, s, s); ctx.fillRect(x0 + mx * s, y0 + my * s, 2 * s, s); ctx.fillRect(x0 + (mx + 2) * s, y0 + (my + 1) * s, s, s); }
  // 볼
  ctx.fillStyle = PALETTE.P; ctx.fillRect(x0 + (ex - 1) * s, y0 + (ey + 2) * s, s, s); ctx.fillRect(x0 + (W - ex) * s, y0 + (ey + 2) * s, s, s);
}

export function drawIcon(canvas, sprite, scale = 3) {
  const { w, h } = spriteSize(sprite);
  canvas.width = 10 * scale; canvas.height = 8 * scale;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSprite(ctx, sprite, ((10 - w) * scale) / 2, ((8 - h) * scale) / 2, scale);
}
