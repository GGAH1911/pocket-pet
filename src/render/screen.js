// 방 화면 그리기. 게임 규칙은 모르고 받은 상태만 그린다.
// 캔버스는 "도트 해상도"로 그리고 CSS가 정수배로 키운다.
import { PALETTE } from "./palette.js?v=fb4c507-1791115840";
import { SPRITES, drawSprite, spriteSize } from "./sprites.js?v=fb4c507-1791115840";

const FLOOR = "#f5b98c";
const FLOOR_LINE = "#e9a274";
const BASEBOARD = "#e8a37e";

export function drawRoom(ctx, { w, h, now, scene, f }) {
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

  const sc = scene || { stage: "egg" };
  const fr = f || { pose: { dx: 0, dy: 0, sx: 1, sy: 1, eyes: "open", mouth: "auto", facing: 1 }, props: [], texts: [], poopAlpha: 1, poopPop: 0, darkness: sc.asleep ? (sc.lightOn ? 0.18 : 0.62) : sc.lightOn === false ? 0.62 : 0, flash: 0, showStage: sc.stage };
  const baseY = rugY + 4;
  const poopN = fr.poopsOverride !== undefined ? fr.poopsOverride : sc.poops || 0;
  if (poopN) drawPoops(ctx, poopN, { cx, rugY, w, alpha: fr.poopAlpha, pop: fr.poopPop });
  const box = drawPet(ctx, sc, fr, { cx, baseY, now });
  const px = cx + Math.round(fr.pose.dx);
  for (const pr of fr.props) {
    const sp = SPRITES[pr.sprite]; if (!sp || pr.alpha <= 0) continue;
    const { w: sw, h: sh } = spriteSize(sp);
    ctx.globalAlpha = Math.min(1, pr.alpha);
    const ex = pr.edge && box ? Math.sign(pr.edge) * (box.w / 2 + (sw * pr.scale) / 2) : 0; // edge: 펫 몸 옆에 붙여 그리기
    drawSprite(ctx, sp, Math.round(px + ex + pr.x - (sw * pr.scale) / 2), Math.round(baseY + pr.y - sh * pr.scale), pr.scale);
    ctx.globalAlpha = 1;
  }
  if (fr.darkness > 0) { ctx.fillStyle = `rgba(20,16,60,${fr.darkness})`; ctx.fillRect(0, 0, w, h); }
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
  return box;
}

const POOP_SPRITE = [
  "...NN..",
  "..NnnN.",
  ".NnnnnN",
  "NnnnnnN",
  ".NNNNN.",
];

function drawPoops(ctx, n, { cx, rugY, w, alpha = 1, pop = 0 }) {
  const spots = [[-34, -2], [30, 2], [-22, 10], [40, 12]];
  ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const [dx, dy] = spots[i];
    const lift = i === n - 1 ? Math.round(pop * 3) : 0;
    drawSprite(ctx, POOP_SPRITE, Math.round(cx + dx * Math.min(1, w / 140)), rugY + dy - lift, 2);
  }
  ctx.globalAlpha = 1;
}

// M2 시제품: 단계별 크기만 다른 네모 캐릭터(최종 도트는 M3). 자세(pose)에 따라 늘었다 줄었다 한다.
const BODY = { animal: ["#ffb3c4", "#e86a8a"], fantasy: ["#c9b6ff", "#8f74e6"] };
const SIZE = { baby: 14, child: 18, teen: 22, adult: 26 };

function drawEgg(ctx, cx, baseY, now, egg) {
  const sp = SPRITES.egg, { w: ew, h: eh } = spriteSize(sp);
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
}

function drawPet(ctx, scene, fr, { cx, baseY, now }) {
  const pose = fr.pose;
  const stage = fr.showStage || scene.stage;
  if (stage === "egg") { drawEgg(ctx, cx, baseY, now, fr.egg); return null; }
  const [fill, edge] = BODY[scene.theme] || BODY.animal;
  const size = SIZE[stage] || 18;
  const s = 2;
  const bw = Math.max(8, Math.round(size * s * pose.sx / 2) * 2);
  const bh = Math.max(8, Math.round((size - 2) * s * pose.sy / 2) * 2);
  const x0 = Math.round(cx + pose.dx - bw / 2);
  const y0 = Math.round(baseY + pose.dy - bh);
  // 그림자
  ctx.fillStyle = "rgba(59,44,53,0.18)";
  const shw = Math.round(bw * (1 - Math.min(0.5, -pose.dy / 30)));
  ctx.fillRect(Math.round(cx + pose.dx - shw / 2), baseY - 1, shw, 3);
  // 몸 (둥근 네모: 테두리 → 진한 색 → 밝은 색)
  ctx.fillStyle = PALETTE.k; ctx.fillRect(x0 + s, y0, bw - 2 * s, bh); ctx.fillRect(x0, y0 + s, bw, bh - 2 * s);
  ctx.fillStyle = edge; ctx.fillRect(x0 + 2 * s, y0 + s, bw - 4 * s, bh - 2 * s); ctx.fillRect(x0 + s, y0 + 2 * s, bw - 2 * s, bh - 4 * s);
  ctx.fillStyle = fill; ctx.fillRect(x0 + 2 * s, y0 + s, bw - 4 * s, bh - 4 * s); ctx.fillRect(x0 + s, y0 + 2 * s, bw - 2 * s, bh - 6 * s);
  if (scene.sick) { ctx.fillStyle = "rgba(120,200,120,0.35)"; ctx.fillRect(x0 + s, y0 + s, bw - 2 * s, bh - 2 * s); }
  // 얼굴 위치 (바라보는 쪽으로 살짝)
  const look = (pose.facing || 1) * s;
  const exL = x0 + Math.round(bw * 0.28) + look, exR = x0 + bw - Math.round(bw * 0.28) - 2 * s + look;
  const ey = y0 + Math.round(bh * 0.38);
  ctx.fillStyle = PALETTE.k;
  const eye = (ex, right) => {
    switch (pose.eyes) {
      case "closed": case "sleep": ctx.fillRect(ex - s / 2, ey + s, 3 * s, s); break;
      case "happy": ctx.fillRect(ex - s / 2, ey + s, s, s); ctx.fillRect(ex + s / 2, ey, s, s); ctx.fillRect(ex + 1.5 * s, ey + s, s, s); break;
      case "x":
        if (right) { ctx.fillRect(ex + s, ey - s / 2, s, s); ctx.fillRect(ex, ey + s / 2, s, s); ctx.fillRect(ex + s, ey + 1.5 * s, s, s); }
        else { ctx.fillRect(ex, ey - s / 2, s, s); ctx.fillRect(ex + s, ey + s / 2, s, s); ctx.fillRect(ex, ey + 1.5 * s, s, s); }
        break;
      default: ctx.fillRect(ex, ey - s, s, 2 * s); ctx.fillStyle = PALETTE.w; ctx.fillRect(ex, ey - s, s / 2, s / 2); ctx.fillStyle = PALETTE.k;
    }
  };
  eye(exL, false); eye(exR, true);
  // 입
  const mood = scene.mood ?? 100;
  const mouth = pose.mouth === "auto" ? (mood >= 50 ? "smile" : mood >= 20 ? "flat" : "sad") : pose.mouth;
  const mx = x0 + Math.round(bw / 2) - s + look, my = ey + 3 * s;
  switch (mouth) {
    case "smile": ctx.fillRect(mx - s, my, s, s); ctx.fillRect(mx, my + s, 2 * s, s); ctx.fillRect(mx + 2 * s, my, s, s); break;
    case "open": ctx.fillRect(mx - s / 2, my - s / 2, 3 * s, 3 * s); ctx.fillStyle = PALETTE.P; ctx.fillRect(mx, my + s / 2, 2 * s, 1.5 * s); ctx.fillStyle = PALETTE.k; break;
    case "sad": ctx.fillRect(mx - s, my + s, s, s); ctx.fillRect(mx, my, 2 * s, s); ctx.fillRect(mx + 2 * s, my + s, s, s); break;
    default: ctx.fillRect(mx, my, 2 * s, s);
  }
  // 볼
  ctx.fillStyle = PALETTE.P; ctx.fillRect(exL - s, ey + 2 * s, s, s); ctx.fillRect(exR + 2 * s, ey + 2 * s, s, s);
  // 눈물
  if (pose.tears) {
    ctx.fillStyle = PALETTE.b;
    for (const [ex, off] of [[exL, 0], [exR + s, 0.5]]) {
      const ph = ((now / 700) + off) % 1;
      ctx.fillRect(ex, ey + 2 * s + Math.round(ph * bh * 0.5), s, 2 * s);
    }
  }
  // 어지러움(아플 때): 머리 위를 도는 별
  if (pose.dizzy) {
    for (let i = 0; i < 3; i++) {
      const ang = now / 260 + (i * Math.PI * 2) / 3;
      drawSprite(ctx, SPRITES.sparkle, Math.round(x0 + bw / 2 + Math.cos(ang) * bw * 0.45) - 2, Math.round(y0 - 8 + Math.sin(ang) * 4) - 2, 1);
    }
  }
  return { x: x0, y: y0, w: bw, h: bh };
}

export function drawIcon(canvas, sprite, scale = 3) {
  const { w, h } = spriteSize(sprite);
  canvas.width = 10 * scale; canvas.height = 8 * scale;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSprite(ctx, sprite, ((10 - w) * scale) / 2, ((8 - h) * scale) / 2, scale);
}
