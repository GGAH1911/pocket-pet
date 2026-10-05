// 방 화면 그리기. 게임 규칙은 모르고 받은 상태만 그린다.
// 캔버스는 "도트 해상도"로 그리고 CSS가 정수배로 키운다.
import { PALETTE } from "./palette.js?v=4532693-1791199752";
import { SPRITES, drawSprite, spriteSize } from "./sprites.js?v=4532693-1791199752";
import { buildCreature, paintGrid, formKey, eggSpriteFor } from "./creature.js?v=4532693-1791199752";
import { drawFace, POOLS } from "./face.js?v=4532693-1791199752";
import { drawSky } from "./sky.js?v=4532693-1791199752";
import { drawWall, drawFloor, drawRug, drawCurtain, drawFurniture, drawLampGlow, HAT_SPRITE, FURN_HALF } from "./deco.js?v=4532693-1791199752";

// 방 배치(그리기와 동작이 같은 좌표를 쓰게 한 곳에서 계산)
export function roomLayout(w, h, deco = {}) {
  const floorY = Math.round(h * 0.5);
  const rugY = Math.round(floorY + (h - floorY) * 0.38);
  const furnBase = floorY + Math.round((h - floorY) * 0.24);
  const half = (id) => FURN_HALF[id] || 12;
  const furnPos = { furnL: Math.max(half(deco.furnL) + 2, Math.round(w * 0.13)), furnR: Math.min(w - half(deco.furnR) - 2, Math.round(w * 0.87)) };
  return { floorY, cx: Math.round(w / 2), rugY, baseY: rugY + 4, furnBase, furnPos };
}
import { WALK_STOPS as WALK_STOPS_REF, walkDist as walkDistRef } from "./anim.js?v=4532693-1791199752";
const clamp01 = (x) => Math.max(0, Math.min(1, x));

const FLOOR = "#f5b98c";
const FLOOR_LINE = "#e9a274";
const BASEBOARD = "#e8a37e";

export function drawRoom(ctx, { w, h, now, scene, f, wall = Date.now(), loc = { lat: 37.57, lon: 126.98 }, weather = null }) {
  if (f && f.walk) return drawWalk(ctx, { w, h, now, scene, f, wall, loc, weather }); // 산책 중엔 바깥 장면
  const floorY = Math.round(h * 0.5);

  const deco = (scene && scene.deco) || {}; // 꾸미기(벽지·바닥·러그·커튼·가구·머리)
  // 벽
  drawWall(ctx, w, floorY, deco.wall);

  // 창문: 실제 시각·위치의 하늘(낮·노을·밤, 해·달·별)
  const win = windowRect(w, floorY);
  const skyInfo = drawWindow(ctx, win, wall, loc, now, 0, weather);
  drawCurtain(ctx, win, deco.curtain);

  // 액자: 도감 보상 '추억 액자'가 열리면 가장 최근 함께한 친구 그림(금 액자 보상이면 금색 테두리)
  const memo = scene && scene.memory;
  if (memo) drawMemoryFrame(ctx, Math.round(w * 0.64), Math.round(floorY * 0.2), memo);
  else {
    const fx = Math.round(w * 0.7), fy = Math.round(floorY * 0.36);
    ctx.fillStyle = PALETTE.o; ctx.fillRect(fx, fy, 22, 18);
    ctx.fillStyle = PALETTE.g; ctx.fillRect(fx + 2, fy + 2, 18, 14);
    ctx.fillStyle = PALETTE.G; ctx.fillRect(fx + 4, fy + 9, 6, 7); ctx.fillRect(fx + 11, fy + 6, 6, 10);
  }

  // 걸레받이 + 바닥
  ctx.fillStyle = BASEBOARD; ctx.fillRect(0, floorY - 3, w, 3);
  drawFloor(ctx, w, h, floorY, deco.floor);

  // 러그
  const cx = Math.round(w / 2), rugY = Math.round(floorY + (h - floorY) * 0.38);
  drawRug(ctx, cx, rugY, w, deco.rug || (scene && scene.rug === "star" ? "rug_star" : "rug_pink"));

  // 가구(왼쪽·오른쪽, 펫 뒤)
  const { furnBase, furnPos } = roomLayout(w, h, deco); // 가구는 넓이에 맞춰 화면 안에
  const darkNow = (f && f.darkness) || 0;
  for (const slot of ["furnL", "furnR"]) if (deco[slot]) drawFurniture(ctx, deco[slot], furnPos[slot], furnBase, { now, dark: darkNow });

  const sc = scene || { stage: "egg" };
  const fr = f || { pose: { dx: 0, dy: 0, sx: 1, sy: 1, eyes: null, mouth: null, facing: 1 }, props: [], texts: [], fx: [], darkness: sc.lightOn === false ? 0.62 : sc.asleep ? 0.18 : 0, flash: 0 };
  const baseY = rugY + 4;
  const poopRects = drawPoops(ctx, sc.poopSlots || [], { cx, rugY, w, pop: fr.poopPop || 0 });
  const box = fr.hidePet ? null : drawPet(ctx, sc, fr, { cx, baseY, now });
  if (fr.onSofa && deco.furnR === "sofa") drawFurniture(ctx, "sofa", furnPos.furnR, furnBase, { front: true }); // 소파에 앉은 모습: 좌석 앞면·팔걸이를 펫 앞에
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
  if (deco.furnL === "lamp") drawLampGlow(ctx, furnPos.furnL, furnBase, fr.darkness || 0); // 불 끈 밤에 스탠드가 은은하게
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

// ---------- 산책: 바깥 장면 ----------
// 하늘은 실제 시각·날씨(창문과 같은 drawSky), 나무(먼 층)·길·풀(가까운 층)이 다른 속도로 흐른다.
const hashN = (n) => { const x = Math.sin(n * 91.7) * 43758.5453; return x - Math.floor(x); };
const FRIEND_CACHE = new Map();
function drawWalk(ctx, { w, h, now, scene, f, wall, loc, weather }) {
  const wk = f.walk, d = wk.dist;
  const groundY = Math.round(h * 0.5);
  const info = drawSky(ctx, { x: 0, y: 0, w, h: groundY }, wall, loc, now, weather);
  const night = clamp01(-(info.sunAlt ?? 10) / 12) * 0.5; // 밤엔 땅도 어둡게
  // 먼 나무(0.45배 속도)
  const span = 44;
  for (let i = -1; i < Math.ceil(w / span) + 2; i++) {
    const wi = Math.floor(d * 0.45 / span) + i; // 세계 번호(같은 나무는 같은 모양)
    const tx = Math.round(wi * span - d * 0.45 + hashN(wi) * 14);
    const th = 14 + Math.round(hashN(wi + 7) * 8), r = 8 + Math.round(hashN(wi + 3) * 4);
    ctx.fillStyle = PALETTE.n; ctx.fillRect(tx - 1, groundY - th + r, 3, th - r + 2);
    for (const [cc, rr, oy] of [[PALETTE.k, r + 1, 0], [PALETTE.G, r, 0], [PALETTE.g, r - 3, -2]]) for (let yy = -rr; yy <= rr; yy++) { const hw = Math.round(Math.sqrt(rr * rr - yy * yy)); ctx.fillStyle = cc; ctx.fillRect(tx - hw, groundY - th + yy + oy + 2, hw * 2 + 1, 1); } // 동그란 나뭇잎(테두리도 동그랗게)
  }
  // 땅: 풀 + 길
  const pathTop = groundY + Math.round((h - groundY) * 0.28), pathH = 24;
  ctx.fillStyle = PALETTE.g; ctx.fillRect(0, groundY, w, h - groundY);
  ctx.fillStyle = PALETTE.G; for (let y = groundY + 4; y < h; y += 9) for (let x = -((d * 1.2) % 16); x < w; x += 16) ctx.fillRect(Math.round(x + (y % 3) * 5), y, 2, 1);
  ctx.fillStyle = "#f0d6a8"; ctx.fillRect(0, pathTop, w, pathH);
  ctx.fillStyle = "#e2bf86"; ctx.fillRect(0, pathTop, w, 2); ctx.fillRect(0, pathTop + pathH - 2, w, 2);
  for (let i = -1; i < w / 20 + 2; i++) { const wi = Math.floor(d / 20) + i; const x = Math.round(wi * 20 - d); ctx.fillStyle = "#d9b47a"; ctx.fillRect(x + Math.round(hashN(wi) * 12), pathTop + 5 + Math.round(hashN(wi + 1) * 14), 2, 1); }
  // 가까운 풀숲·꽃(1.3배 속도)
  for (let i = -1; i < w / 26 + 2; i++) {
    const wi = Math.floor(d * 1.3 / 26) + i; const x = Math.round(wi * 26 - d * 1.3 + hashN(wi + 9) * 10), y = pathTop + pathH + 10 + Math.round(hashN(wi + 2) * 12);
    ctx.fillStyle = PALETTE.G; ctx.fillRect(x, y - 3, 1, 3); ctx.fillRect(x + 2, y - 4, 1, 4); ctx.fillRect(x + 4, y - 2, 1, 2);
    if (hashN(wi + 5) > 0.55) { ctx.fillStyle = [PALETTE.p, PALETTE.y, PALETTE.w, PALETTE.v][Math.floor(hashN(wi + 6) * 4)]; ctx.fillRect(x + 1, y - 6, 3, 2); ctx.fillStyle = PALETTE.y; ctx.fillRect(x + 2, y - 6, 1, 1); }
  }
  if (night > 0) { ctx.fillStyle = `rgba(20,16,60,${night})`; ctx.fillRect(0, groundY - 30, w, h - groundY + 30); }

  // 만나는 것들(길 위, 세계 위치에 고정 → 걸어가면 다가옴)
  const petX = Math.round(w * 0.38), baseY = pathTop + 17;
  const sc = scene || {};
  const things = wk.events.map((ev, i) => {
    const a = WALK_STOPS_REF[i] ? WALK_STOPS_REF[i][0] : 0;
    const ex = petX + (ev.kind === "puddle" ? 2 : 44) + (walkDistRef(a) - d); // 멈출 때: 웅덩이는 발밑(뛰어들기), 나머지는 펫 앞 44px
    const k = wk.cur && wk.cur.i === i ? wk.cur.k : (wk.t > (WALK_STOPS_REF[i] || [0, 0])[1] ? 1 : 0);
    return { ev, x: Math.round(ex), k };
  }).filter((o) => o.x > -40 && o.x < w + 40);
  for (const o of things) if (o.ev.kind !== "butterfly") drawWalkThing(ctx, o.ev, o.x, baseY, o.k, now, petX); // 땅에 있는 것은 펫 뒤
  // 펫 그림자 + 펫
  ctx.fillStyle = "rgba(59,44,53,0.18)"; ctx.fillRect(petX - 14, baseY - 1, 28, 3);
  const box = drawPet(ctx, { ...sc, asleep: false, napping: false }, f, { cx: petX, baseY, now });
  const px = petX + Math.round(f.pose.dx);
  for (const pr of f.props) {
    const sp = SPRITES[pr.sprite]; if (!sp || pr.alpha <= 0) continue;
    const { w: sw, h: sh } = spriteSize(sp);
    ctx.globalAlpha = Math.min(1, pr.alpha);
    drawSprite(ctx, sp, Math.round(px + pr.x - (sw * pr.scale) / 2), Math.round(baseY + pr.y - sh * pr.scale), pr.scale);
    ctx.globalAlpha = 1;
  }
  for (const o of things) if (o.ev.kind === "butterfly") drawWalkThing(ctx, o.ev, o.x, baseY, o.k, now, petX); // 나비는 펫 위(머리 위를 맴돎)
  // 계절 날림: 봄 벚꽃잎, 가을 낙엽
  if (wk.season) {
    const cols = wk.season === "spring" ? [PALETTE.p, "#ffd1dc"] : [PALETTE.o, PALETTE.O, PALETTE.r];
    for (let i = 0; i < 12; i++) {
      const ph = ((now / 5200) + hashN(i)) % 1;
      const x = Math.round(((hashN(i + 20) * w + now / 30 * (0.4 + hashN(i + 3))) % (w + 10)) - 5 + Math.sin(ph * 8 + i) * 4), y = Math.round(ph * (h * 0.85));
      ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(x, y, 2, 1); ctx.fillRect(x + (Math.floor(now / 300 + i) % 2), y + 1, 1, 1);
    }
  }
  // 비·눈은 땅 위까지
  if (weather && ["rain", "drizzle", "thunder", "sleet"].includes(weather.kind)) {
    ctx.fillStyle = "rgba(200,220,255,0.7)";
    for (let i = 0; i < 26; i++) { const x = Math.round((hashN(i) * w + now / 6) % w), y = Math.round((hashN(i + 40) * h + now / 3) % h); if (y > groundY) ctx.fillRect(x, y, 1, 3); }
  } else if (weather && weather.kind === "snow") {
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 20; i++) { const x = Math.round((hashN(i) * w + Math.sin(now / 700 + i) * 6) % w), y = Math.round((hashN(i + 40) * h + now / 25) % h); if (y > groundY) ctx.fillRect(x, y, 2, 2); }
  }
  for (const t of f.texts) {
    if (t.alpha <= 0 || t.abs) continue;
    ctx.globalAlpha = Math.min(1, t.alpha); ctx.fillStyle = t.color || PALETTE.k;
    ctx.font = `bold ${Math.round(t.size)}px system-ui, sans-serif`; ctx.textAlign = "center";
    ctx.fillText(t.text, Math.round(px + t.x), Math.round(baseY + t.y)); ctx.globalAlpha = 1;
  }
  if (wk.fade > 0) { ctx.fillStyle = `rgba(255,250,240,${Math.min(1, wk.fade)})`; ctx.fillRect(0, 0, w, h); }
  return { pet: null, poops: [], window: null, sky: info, memo: null, layout: { w, h, cx: petX, baseY, headY: box ? box.y + 4 : baseY - 30 } };
}

// 산책길에서 만나는 것: 나비·꽃·웅덩이·친구
function drawWalkThing(ctx, ev, x, baseY, k, now, petX) {
  if (ev.kind === "flower") {
    ctx.fillStyle = PALETTE.G; ctx.fillRect(x, baseY - 10, 1, 10); ctx.fillRect(x - 2, baseY - 5, 2, 1);
    ctx.fillStyle = PALETTE.k; ctx.fillRect(x - 4, baseY - 16, 9, 7);
    ctx.fillStyle = PALETTE.p; ctx.fillRect(x - 3, baseY - 15, 7, 5); ctx.fillStyle = PALETTE.P; ctx.fillRect(x - 3, baseY - 15, 1, 1); ctx.fillRect(x + 3, baseY - 11, 1, 1);
    ctx.fillStyle = PALETTE.y; ctx.fillRect(x - 1, baseY - 13, 3, 2);
  } else if (ev.kind === "puddle") {
    const px = x - 10;
    ctx.fillStyle = PALETTE.B; for (let yy = -2; yy <= 2; yy++) { const hw = Math.round(Math.sqrt(1 - (yy / 3) ** 2) * 13); ctx.fillRect(px + 10 - hw, baseY + yy, hw * 2, 1); }
    ctx.fillStyle = PALETTE.b; ctx.fillRect(px + 2, baseY - 1, 14, 2); ctx.fillStyle = PALETTE.w; ctx.fillRect(px + 4, baseY - 1, 3, 1);
    if (k > 0.5 && k < 0.85) { const s = (k - 0.5) / 0.35; ctx.fillStyle = PALETTE.b; for (let i = 0; i < 6; i++) { const ang = Math.PI * (0.15 + (i / 5) * 0.7); ctx.fillRect(Math.round(px + 10 + Math.cos(ang) * s * 18 * (i % 2 ? 1 : -1)), Math.round(baseY - Math.sin(ang) * s * 14 + s * s * 8), 2, 2); } }
  } else if (ev.kind === "butterfly") {
    // 앞에서 팔랑이다가, 만나면 펫 머리 위를 빙글, 만남이 끝나면 날아가 사라짐
    if (k >= 1) return;
    const t = now / 1000;
    const bx = k > 0 && k < 1 ? petX + Math.cos(t * 3) * 12 + 4 : x + Math.sin(t * 2) * 6;
    const by = k > 0 && k < 1 ? baseY - 40 + Math.sin(t * 5) * 4 : baseY - 26 + Math.sin(t * 3) * 5;
    const flap = Math.floor(now / 120) % 2;
    const X0 = Math.round(bx), Y0 = Math.round(by), R = (dx, dy, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(X0 + dx * 2, Y0 + dy * 2, ww * 2, hh * 2); }; // 2배 도트
    if (flap) { R(-4, -3, 4, 4, PALETTE.k); R(1, -3, 4, 4, PALETTE.k); R(-3, -2, 3, 2, PALETTE.p); R(1, -2, 3, 2, PALETTE.p); R(-2, -2, 1, 1, PALETTE.y); R(2, -2, 1, 1, PALETTE.y); }
    else { R(-4, -1, 4, 3, PALETTE.k); R(1, -1, 4, 3, PALETTE.k); R(-3, 0, 3, 1, PALETTE.p); R(1, 0, 3, 1, PALETTE.p); R(-2, 0, 1, 1, PALETTE.y); R(2, 0, 1, 1, PALETTE.y); }
    R(0, -2, 1, 4, PALETTE.k); // 몸통
  } else if (ev.kind === "friend" && ev.friendKey) {
    let c = FRIEND_CACHE.get(ev.friendKey);
    if (!c && typeof document !== "undefined") {
      const b = buildCreature(ev.friendKey, { facing: -1, look: { spot: ev.spot || "y" } });
      if (b) { drawFace(b.g, b.P, POOLS.great[1]); c = document.createElement("canvas"); c.width = 76; c.height = 50; paintGrid(c.getContext("2d"), b.g, 38, 48, 1); FRIEND_CACHE.set(ev.friendKey, c); }
    }
    const hop = k > 0 && k < 1 ? Math.round(Math.abs(Math.sin(k * Math.PI * 3 + 1)) * 4) : 0;
    ctx.fillStyle = "rgba(59,44,53,0.18)"; ctx.fillRect(x - 8, baseY - 1, 18, 2);
    if (c) ctx.drawImage(c, Math.round(x - 38 + 6), Math.round(baseY - 48 - hop));
    if (k > 0.3 && k < 1) drawSprite(ctx, SPRITES.heart, Math.round(x - 4), Math.round(baseY - 36 - (k - 0.3) * 20), 1);
  }
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
// 동그랗고 복슬한 꼬리(몸 색 + 흰 끝). 엉덩이 골 선은 그리지 않는다(사용자 요청)
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
}
// 머리 장식: 캐릭터마다 실제 그림에서 자리를 찾는다(귀·뿔·물줄기 끝이 아니라 머리 꼭대기, 실제 눈 위치)
const faceCx = (P) => P.cx + (P.rx >= 10 ? P.f * Math.round(P.rx * 0.12) : 0);
function colTop(g, col) { // 그 세로줄에서 처음 칠해진 칸
  if (col < 0 || col >= g.w) return null;
  for (let r = 0; r < g.h; r++) if (g.c[r * g.w + col]) return r;
  return null;
}
// 머리 꼭대기: 얼굴 가운데 ±2줄 중 가장 낮은 꼭대기(가는 뿔·물줄기는 건너뛰고 둥근 머리 윗선을 잡음)
function headTop(g, P, c0 = Math.round(faceCx(P))) {
  let top = -1;
  for (let c = c0 - 2; c <= c0 + 2; c++) { const t = colTop(g, c); if (t != null && t > top) top = t; }
  return top < 0 ? Math.round(P.cy - P.ry) : top;
}
const HAT_SINK = { hatStraw: 3, hatCrown: 2, hatFlower: 3, santaHat: 3, pumpkinHat: 3, partyHat: 2 }; // 머리에 파묻히는 칸 수(쓴 것처럼)
const NO_DODGE = new Set(["fantasy.baby", "fantasy.child"]); // 말랑이·뿔말랑이: 뾰족한 물방울 머리 끝이 곧 머리라 그 위에 씌움
function drawHat(ctx, box, hat, built, faceInfo, facing, key = "") {
  const sp = SPRITES[hat]; if (!sp) return;
  const { g, P } = built;
  const { w: sw, h: sh } = spriteSize(sp);
  const gx = (col) => box.ox + col * CELL, gy = (row) => box.oy + row * CELL;
  if (hat === "hatGlasses") { // 안경: 실제 두 눈에 렌즈를 맞춰 그린다(눈 간격이 캐릭터마다 달라서 그림 하나로는 안 맞음)
    if (!faceInfo) return;
    const eyes = faceInfo.eyes.map(([ex, ey]) => [gx(ex + 0.5), gy(ey + 0.5)]);
    const rx = 5, ry = 4;
    for (const [cx, cy] of eyes) {
      ctx.fillStyle = "rgba(142,203,255,0.35)"; ctx.fillRect(Math.round(cx - rx + 1), Math.round(cy - ry + 1), rx * 2 - 2, ry * 2 - 2);
      ctx.fillStyle = PALETTE.k;
      ctx.fillRect(Math.round(cx - rx + 1), Math.round(cy - ry), rx * 2 - 2, 1); ctx.fillRect(Math.round(cx - rx + 1), Math.round(cy + ry - 1), rx * 2 - 2, 1);
      ctx.fillRect(Math.round(cx - rx), Math.round(cy - ry + 1), 1, ry * 2 - 2); ctx.fillRect(Math.round(cx + rx - 1), Math.round(cy - ry + 1), 1, ry * 2 - 2);
      ctx.fillStyle = PALETTE.w; ctx.fillRect(Math.round(cx - rx + 2), Math.round(cy - ry + 1), 2, 1);
    }
    const [[lx, ly], [rx2]] = eyes;
    ctx.fillStyle = PALETTE.k; ctx.fillRect(Math.round(lx + rx - 1), Math.round(ly - 2), Math.max(0, Math.round(rx2 - rx + 1 - (lx + rx - 1))), 1); // 코받침 다리
    return;
  }
  if (hat === "hatRibbon" || hat === "heartClip") { // 리본·하트 핀: 머리 윗선 한쪽(귀 안쪽)
    const col = Math.round(faceCx(P) + (facing >= 0 ? 1 : -1) * Math.max(2, P.rx * 0.4));
    const ht = headTop(g, P), ct = colTop(g, col);
    const top = ct == null ? ht : Math.max(ct, ht); // 그 줄에 귀·뿔이 걸려 있으면(더 높으면) 귀 끝 말고 머리 윗선에
    const sc = hat === "heartClip" ? 1 : 2;
    drawSprite(ctx, sp, Math.round(gx(col + 0.5) - (sw * sc) / 2), Math.round(gy(top + 1) - (sh * sc) / 2), sc);
    return;
  }
  // 모자류: 머리 꼭대기에 씌우고 몇 칸 파묻어 쓴 것처럼.
  // 얼굴 가운데 근처에 머리 윗선보다 솟은 것(유니콘 뿔·고래 물줄기)이 있으면 반대쪽으로 비켜 씌운다
  let c = Math.round(faceCx(P));
  const dome = headTop(g, P, c);
  const prot = [];
  const tAt = (k) => colTop(g, k) ?? g.h;
  for (let k = c - 3; k <= c + 3; k++) { // 옆 2칸보다 3칸 이상 갑자기 솟은 가는 것만 뿔·물줄기로 본다(뾰족한 물방울 머리는 머리)
    const t = colTop(g, k);
    if (t != null && t < dome - 1 && (tAt(k - 2) - t >= 3 || tAt(k + 2) - t >= 3)) prot.push(k);
  }
  if (prot.length && !NO_DODGE.has(key)) {
    const mid = (Math.min(...prot) + Math.max(...prot)) / 2;
    const side = Math.abs(mid - c) < 0.75 ? -P.f : mid > c ? -1 : 1; // 한가운데면 머리 뒤쪽으로
    const half = sw / 2; // 모자 반폭(격자 칸)
    c = Math.round(side < 0 ? Math.min(...prot) - half * 0.75 - 1 : Math.max(...prot) + half * 0.75 + 1); // 챙 끝만 살짝 겹치게
  }
  const top = headTop(g, P, c), sink = HAT_SINK[hat] ?? 2;
  drawSprite(ctx, sp, Math.round(gx(c + 0.5) - sw), Math.round(gy(top + sink) - sh * 2), 2);
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
  if (bed <= 0 && !fr.onSofa) { // 소파 위에선 바닥 그림자 없음
    ctx.fillStyle = "rgba(59,44,53,0.18)";
    const shw = Math.round(bodyW * (1 - Math.min(0.5, -pose.dy / 30)));
    ctx.fillRect(Math.round(cx + pose.dx - shw / 2), baseY - 1, shw, 3);
  }
  const box = paintGrid(ctx, built.g, x, base, CELL, { alpha: fr.petAlpha ?? 1, tint: scene.sick && !fr.silhouette ? "rgba(150,210,150,0.22)" : null });
  if (fr.back && !fr.silhouette && fr.tailKind !== "own") drawTail(ctx, x, base, built, fr.tailWag || 0); // 엉덩이춤: 꼬리 없는 그림엔 복슬 꼬리, 용처럼 꼬리가 그려진 친구는 그대로
  const hat = fr.hat || HAT_SPRITE[(scene.deco || {}).hat];
  if (hat && !fr.silhouette && !fr.back && box) drawHat(ctx, box, hat, built, faceInfo, pose.facing, key);
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
