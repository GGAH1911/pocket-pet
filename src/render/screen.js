// 방 화면 그리기. 게임 규칙은 모르고 받은 상태만 그린다.
// 캔버스는 "도트 해상도"로 그리고 CSS가 정수배로 키운다.
import { PALETTE } from "./palette.js?v=922cf11-1791119342";
import { SPRITES, drawSprite, spriteSize } from "./sprites.js?v=922cf11-1791119342";
import { buildCreature, paintGrid, formKey } from "./creature.js?v=922cf11-1791119342";
import { drawFace } from "./face.js?v=922cf11-1791119342";

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
  for (const fx of fr.fx || []) drawFx(ctx, fx);
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
  return { pet: box, poops: poopRects };
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

function eggSprite(scene) {
  if (scene.theme === "fantasy") return SPRITES.eggRainbow;
  const l = scene.look || {};
  if (!l.spot) return SPRITES.egg;
  return SPRITES.egg.map((row) => row.replace(/p/g, "#").replace(/g/g, l.spot2 || "g").replace(/#/g, l.spot));
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
const CACHE = new Map();

function drawPet(ctx, scene, fr, { cx, baseY, now }) {
  const pose = fr.pose;
  const key = fr.showKey || formKey(scene.theme || "animal", scene.stage, scene.branch);
  if (key.endsWith(".egg")) return drawEgg(ctx, cx, baseY, now, fr.egg, scene);
  // 같은 모습은 다시 계산하지 않는다(숨쉬기처럼 미세한 늘어남은 0.02 단위로 묶음)
  const q = (v) => Math.round(v * 50) / 50;
  const look = scene.look || {}, fc = scene.face || {};
  const ck = [key, q(pose.sx), q(pose.sy), pose.facing >= 0 ? 1 : -1, look.spot, look.chub, look.messy ? 1 : 0, fr.silhouette ? 1 : 0, pose.eyes, pose.mouth, fc.L, fc.R, fc.m, (fc.ex || []).join(","), fc.dy || 0, fc.look || 0].join("|");
  let cached = CACHE.get(ck);
  if (!cached) {
    const built = buildCreature(key, { sx: q(pose.sx), sy: q(pose.sy), facing: pose.facing, look, silhouette: fr.silhouette ? "w" : null });
    if (!built) return null;
    const faceInfo = fr.silhouette ? null : drawFace(built.g, built.P, scene.face, { eyes: pose.eyes, mouth: pose.mouth });
    cached = { built, faceInfo };
    CACHE.set(ck, cached);
    if (CACHE.size > 80) CACHE.delete(CACHE.keys().next().value);
  }
  const { built, faceInfo } = cached;
  const x = cx + Math.round(pose.dx), base = baseY + Math.round(pose.dy);
  // 그림자 (높이 뛸수록 작아짐)
  ctx.fillStyle = "rgba(59,44,53,0.18)";
  const shw = Math.round(built.P.rx * 2 * CELL * (1 - Math.min(0.5, -pose.dy / 30)));
  ctx.fillRect(Math.round(cx + pose.dx - shw / 2), baseY - 1, shw, 3);
  const box = paintGrid(ctx, built.g, x, base, CELL, { alpha: fr.petAlpha ?? 1, tint: scene.sick && !fr.silhouette ? "rgba(150,210,150,0.22)" : null });
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
