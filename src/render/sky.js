// 창밖 하늘: 실제 시각과 위치의 해 고도로 하늘색을 정하고(낮·노을·박명·밤),
// 해와 달은 실제 방향·높이에 맞춰 창 안에 그린다. 달 모양은 실제 위상.
import { sunPosition, moonPosition, moonIllumination } from "../core/astro.js?v=5abef87-1791550150";

// 해 고도(도) → [위쪽 하늘, 지평선 쪽 하늘]
const KEYS = [
  [-90, "#070b22", "#10173a"],
  [-14, "#0b1030", "#1b2453"],
  [-9, "#1b2758", "#3f4688"],
  [-5, "#2f3c7a", "#b0658a"],
  [-1.5, "#4f66ad", "#ff8a66"],
  [2, "#6f93d6", "#ffb47a"],
  [6, "#7fb0ea", "#ffe0a8"],
  [12, "#74b6f4", "#c6e6ff"],
  [90, "#5aa6f0", "#b4dcfc"],
];

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const CLEAR = { kind: "clear", intensity: 0, cloud: 0.15 };

function skyColors(alt, morning) {
  let i = 0; while (i < KEYS.length - 2 && alt > KEYS[i + 1][0]) i++;
  const [a0, t0, h0] = KEYS[i], [a1, t1, h1] = KEYS[i + 1];
  const t = clamp01((alt - a0) / (a1 - a0));
  let top = mix(hex(t0), hex(t1), t), hor = mix(hex(h0), hex(h1), t);
  // 아침 노을은 조금 더 분홍·연하게, 저녁 노을은 더 주황·진하게
  if (alt > -8 && alt < 8) hor = mix(hor, morning ? [255, 182, 193] : [255, 120, 70], 0.18 * (1 - Math.abs(alt) / 8));
  return { top, hor };
}

// 계산은 10초마다 한 번만
let memo = { key: "", v: null };
export function skyState(wall, lat, lon) {
  const key = `${Math.floor(wall / 10000)}|${lat}|${lon}`;
  if (memo.key === key) return memo.v;
  const sun = sunPosition(wall, lat, lon), moon = moonPosition(wall, lat, lon), ill = moonIllumination(wall);
  memo = { key, v: { sun, moon, ill, south: lat < 0 } };
  return memo.v;
}

// 하늘 위치 → 창 안 좌표. 창은 남쪽을 향하고(남반구는 북쪽), 방위 60°~300°를 가로로 펼친다.
// 떠 있기만 하면 늘 창 안에 온전히 보이도록 가장자리·꼭대기에서 멈춘다(높이 뜬 달도 보이게).
function toWindow(az, alt, r, south, R = 0) {
  const a = south ? (az + 180) % 360 : az;
  const fx = Math.max(0, Math.min(1, (a - 60) / 240)); // 0 = 동쪽(왼쪽), 1 = 서쪽(오른쪽)
  const fy = 1 - Math.max(0, Math.min(70, alt)) / 70; // 0 = 꼭대기(고도 70° 이상), 1 = 지평선
  const x = r.x + R + 1 + fx * (r.w - 2 * R - 2);
  const y = r.y + R + 1 + fy * (r.h * 0.84 - R - 1);
  return { x, y, inside: true };
}

const STARS = [[0.12, 0.15], [0.3, 0.32], [0.46, 0.1], [0.62, 0.26], [0.8, 0.12], [0.9, 0.4], [0.2, 0.5], [0.55, 0.45], [0.72, 0.55], [0.38, 0.6], [0.06, 0.38]];

function drawMoon(ctx, cx, cy, R, phase, south, alpha, day = false, fraction = 1) {
  if (fraction < 0.03 && !day) { // 삭 무렵: 거의 안 보이는 달, 흐린 윤곽만
    for (let a = 0; a < 24; a++) { const ang = (a / 24) * Math.PI * 2; ctx.fillStyle = `rgba(150,160,200,${alpha * 0.35})`; ctx.fillRect(Math.round(cx + Math.cos(ang) * R), Math.round(cy + Math.sin(ang) * R), 1, 1); }
    return;
  }
  // phase: 0 삭 → 0.5 보름 → 1 삭. 북반구는 차오를 때 오른쪽부터 밝아짐
  const p = ((phase % 1) + 1) % 1;
  for (let y = -R; y <= R; y++) {
    const half = Math.sqrt(Math.max(0, R * R - y * y));
    for (let x = -R; x <= R; x++) {
      if (x * x + y * y > R * R + 0.5) continue;
      let xs = south ? -x : x;
      const term = Math.cos(2 * Math.PI * p) * half;
      const lit = p < 0.5 ? xs > term : xs < -term;
      if (!lit && day) continue; // 낮달은 밝은 부분만
      ctx.fillStyle = lit ? (day ? `rgba(255,255,255,${alpha})` : `rgba(255,244,194,${alpha})`) : `rgba(70,82,130,${alpha * 0.55})`;
      ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  }
}

// 창 안(r: x,y,w,h)에 하늘을 그린다. t: 애니메이션 시간(ms)
export function drawSky(ctx, r, wall, loc, t, weather = CLEAR) {
  const wx = weather || CLEAR;
  const { sun, moon, ill, south } = skyState(wall, loc.lat, loc.lon);
  const alt = sun.altitude;
  const morning = (south ? (sun.azimuth + 180) % 360 : sun.azimuth) < 180;
  let { top, hor } = skyColors(alt, morning);
  // 구름 낀 날: 하늘이 회색빛으로(낮은 밝은 회색, 밤은 어두운 회색)
  const overcast = clamp01((wx.cloud - 0.45) / 0.55) * (wx.kind === "clear" || wx.kind === "cloudy" ? 0.35 : 0.7);
  if (overcast > 0) {
    const grey = mix([38, 42, 60], [158, 166, 180], clamp01((alt + 6) / 14));
    top = mix(top, grey, overcast); hor = mix(hor, mix(grey, [255, 255, 255], 0.08), overcast);
  }
  const clearSky = 1 - overcast;
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  // 하늘: 도트 느낌이 나게 몇 줄씩 끊어서
  const bands = 7;
  for (let i = 0; i < bands; i++) {
    const k = Math.pow(i / (bands - 1), 1.3);
    ctx.fillStyle = css(mix(top, hor, k));
    const y0 = r.y + Math.floor((i * r.h) / bands), y1 = r.y + Math.floor(((i + 1) * r.h) / bands);
    ctx.fillRect(r.x, y0, r.w, y1 - y0);
  }
  // 해 근처 지평선이 붉게 물듦(일출·일몰 무렵)
  const sunR = Math.max(3, Math.round(r.w / 11));
  const sp = toWindow(sun.azimuth, Math.max(alt, -4), r, south, sunR + 2);
  if (alt > -10 && alt < 14) {
    const glow = 1 - Math.abs(alt - 1) / 13;
    const gx = Math.max(r.x, Math.min(r.x + r.w, sp.x));
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = css(alt > 3 ? [255, 236, 170] : [255, 150, 90], 0.12 * glow * clearSky);
      const rr = r.w * (0.25 + i * 0.14);
      ctx.beginPath(); ctx.ellipse(gx, r.y + r.h * 0.9, rr, r.h * (0.18 + i * 0.1), 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 별
  const starA = clamp01((-6 - alt) / 8) * clamp01(1 - wx.cloud * 1.1);
  if (starA > 0) for (let i = 0; i < STARS.length; i++) {
    const [sx, sy] = STARS[i];
    const tw = 0.55 + 0.45 * Math.sin(t / 500 + i * 1.7);
    ctx.fillStyle = `rgba(255,255,230,${starA * tw})`;
    ctx.fillRect(Math.round(r.x + sx * r.w), Math.round(r.y + sy * r.h * 0.8), 1, 1);
  }
  // 달
  // 달: 떠 있으면 실제 자리. 밤인데 지평선 아래면 창 오른쪽 위에(밤에는 늘 달이 보이게, 모양은 실제)
  const night = alt < -4;
  if (moon.altitude > -1 || night) {
    const R = Math.max(3, Math.round(r.w / 12));
    const real = moon.altitude > -1;
    const mp = real ? toWindow(moon.azimuth, moon.altitude, r, south, R) : toWindow(south ? 65 : 245, 50, r, south, R);
    const day = alt > 3;
    const cloudDim = Math.max(0.5, 1 - wx.cloud * 0.45); // 구름 낀 밤에도 달은 보이게(조금 흐리게)
    drawMoon(ctx, mp.x, mp.y, R, ill.phase, south, (day ? 0.6 : 1) * cloudDim, day, ill.fraction);
  }
  // 해
  if (alt > -1.5 && sp.inside) {
    const R = sunR + (alt < 6 ? 1 : 0); // 지평선 근처에선 크게
    const col = alt < 4 ? [255, 140, 70] : alt < 10 ? [255, 200, 90] : [255, 238, 140];
    ctx.fillStyle = css(col, 0.35 * clearSky);
    ctx.beginPath(); ctx.arc(sp.x, sp.y, R + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = css(col, Math.max(0.25, clearSky)); // 흐린 날은 구름 뒤 희미한 해
    ctx.beginPath(); ctx.arc(sp.x, sp.y, R, 0, Math.PI * 2); ctx.fill();
  }
  // 구름(하늘색에 물듦, 구름양만큼 많아지고 비·눈 오는 날은 회색)
  let cloudCol = alt > 8 ? [255, 255, 255] : alt > 0 ? [255, 214, 196] : alt > -7 ? [214, 150, 175] : [72, 82, 125];
  const wet = ["rain", "drizzle", "snow", "sleet", "thunder"].includes(wx.kind);
  if (wet || wx.kind === "overcast") cloudCol = mix(cloudCol, alt > 0 ? [150, 156, 170] : [52, 58, 82], wx.kind === "drizzle" ? 0.4 : 0.7);
  const nClouds = 1 + Math.round(wx.cloud * 5);
  for (let i = 0; i < nClouds; i++) {
    const span = r.w + 28;
    const speed = 420 + hash(i) * 400;
    const cx = r.x - 14 + (((t / speed) + hash(i + 7) * span) % span);
    const cy = r.y + r.h * (0.08 + hash(i + 3) * 0.42);
    const big = wx.cloud > 0.6 ? 1.5 : 1;
    ctx.fillStyle = css(cloudCol, alt > -7 ? 0.95 : 0.75);
    ctx.fillRect(Math.round(cx), Math.round(cy), Math.round(12 * big), Math.round(4 * big)); ctx.fillRect(Math.round(cx + 3 * big), Math.round(cy - 3 * big), Math.round(6 * big), Math.round(3 * big));
  }
  // 언덕 실루엣(빛에 따라 색이 변함)
  const hillDay = [127, 197, 143], hillDusk = [107, 90, 122], hillNight = [26, 33, 64];
  const hill = alt > 6 ? hillDay : alt > -2 ? mix(hillDusk, hillDay, clamp01((alt + 2) / 8)) : mix(hillNight, hillDusk, clamp01((alt + 10) / 8));
  const snowy = wx.kind === "snow" || (wx.kind === "sleet" && wx.intensity > 0.6);
  ctx.fillStyle = css(snowy ? mix(hill, alt > -4 ? [245, 248, 255] : [150, 160, 190], 0.8) : hill); // 눈 오면 언덕이 하얗게
  for (let x = 0; x < r.w; x++) {
    const hh = Math.round(r.h * (0.1 + 0.06 * Math.sin(x / 6) + 0.04 * Math.sin(x / 2.7 + 1)));
    ctx.fillRect(r.x + x, r.y + r.h - hh, 1, hh);
  }
  // 밤에는 언덕 위 작은 집 불빛
  if (alt < -4) { ctx.fillStyle = "rgba(255,214,120,0.9)"; ctx.fillRect(Math.round(r.x + r.w * 0.7), Math.round(r.y + r.h * 0.84), 1, 1); ctx.fillRect(Math.round(r.x + r.w * 0.2), Math.round(r.y + r.h * 0.86), 1, 1); }
  drawWeather(ctx, r, t, wx, alt);
  ctx.restore();
  return { sunAlt: alt, moonAlt: moon.altitude, phase: ill.phase, fraction: ill.fraction, snowy };
}

// 비·눈·안개·천둥
function drawWeather(ctx, r, t, wx, alt) {
  const k = wx.kind, I = wx.intensity || 0;
  const rainCol = alt > -2 ? "rgba(225,235,255,0.8)" : "rgba(165,180,220,0.75)";
  if (k === "rain" || k === "drizzle" || k === "thunder" || k === "sleet") {
    const drizzle = k === "drizzle";
    const n = Math.round((drizzle ? 6 : 10) + (drizzle ? 18 : 36) * I);
    const len = drizzle ? 2 : 4, speed = drizzle ? 0.035 : 0.09;
    ctx.fillStyle = rainCol;
    for (let i = 0; i < n * (k === "sleet" ? 0.6 : 1); i++) {
      const x0 = hash(i) * (r.w + 8);
      const y = ((t * speed * (0.8 + hash(i + 9) * 0.4) + hash(i + 50) * (r.h + 10)) % (r.h + 10)) - 6;
      const x = x0 - y * 0.25; // 살짝 비스듬히
      for (let j = 0; j < len; j++) ctx.fillRect(Math.round(r.x + x - j * 0.25), Math.round(r.y + y + j), 1, 1);
    }
  }
  if (k === "snow" || k === "sleet") {
    const n = Math.round(8 + 32 * I * (k === "sleet" ? 0.5 : 1));
    for (let i = 0; i < n; i++) {
      const y = ((t * (0.008 + hash(i + 4) * 0.01) + hash(i + 30) * (r.h + 6)) % (r.h + 6)) - 3;
      const x = hash(i + 11) * r.w + Math.sin(t / 700 + i) * 2;
      const big = hash(i + 21) > 0.7 ? 2 : 1;
      ctx.fillStyle = alt > -4 ? "rgba(255,255,255,0.95)" : "rgba(225,232,255,0.9)";
      ctx.fillRect(Math.round(r.x + x), Math.round(r.y + y), big, big);
    }
  }
  if (k === "fog") {
    for (let i = 0; i < 4; i++) {
      const y = r.y + r.h * (0.25 + i * 0.2);
      const off = ((t / (900 + i * 300)) % (r.w + 30)) - 15;
      ctx.fillStyle = `rgba(230,232,240,${0.22 * I + 0.08})`;
      ctx.fillRect(Math.round(r.x + off - r.w), Math.round(y), r.w * 2, 3);
    }
    ctx.fillStyle = `rgba(225,228,236,${0.25 * I})`; ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  if (k === "thunder") {
    // 7초쯤마다 번쩍(두 번 깜빡), 가끔 번개 줄기
    const cyc = 7000 + Math.floor(t / 7000) % 3 * 1300, ph = t % cyc;
    const flash = ph < 90 ? 0.75 : ph > 180 && ph < 250 ? 0.5 : 0;
    if (flash) {
      ctx.fillStyle = `rgba(255,255,240,${flash})`; ctx.fillRect(r.x, r.y, r.w, r.h);
      const bx = r.x + r.w * (0.2 + hash(Math.floor(t / cyc)) * 0.6);
      ctx.fillStyle = "rgba(255,250,200,1)";
      let x = bx; for (let y = r.y; y < r.y + r.h * 0.75; y += 2) { x += (hash(y + Math.floor(t / cyc)) - 0.5) * 3; ctx.fillRect(Math.round(x), y, 1, 2); }
    }
  }
}
