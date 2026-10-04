// 방 화면 그리기. 게임 규칙은 모르고 받은 상태만 그린다.
// 캔버스는 "도트 해상도"로 그리고 CSS가 정수배로 키운다.
import { PALETTE } from "./palette.js?v=497c29d-1791112943";
import { SPRITES, drawSprite, spriteSize } from "./sprites.js?v=497c29d-1791112943";

const FLOOR = "#f5b98c";
const FLOOR_LINE = "#e9a274";
const BASEBOARD = "#e8a37e";

export function drawRoom(ctx, { w, h, now }) {
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

  // 알: 2초마다 살짝 흔들림
  const egg = SPRITES.egg, { w: ew, h: eh } = spriteSize(egg);
  const scale = 2;
  const wobble = Math.floor(now / 250) % 8 === 0 ? -1 : Math.floor(now / 250) % 8 === 1 ? 1 : 0;
  drawSprite(ctx, egg, cx - (ew * scale) / 2 + wobble * scale, rugY - eh * scale + 4, scale);
}

export function drawIcon(canvas, sprite, scale = 3) {
  const { w, h } = spriteSize(sprite);
  canvas.width = 10 * scale; canvas.height = 8 * scale;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSprite(ctx, sprite, ((10 - w) * scale) / 2, ((8 - h) * scale) / 2, scale);
}
