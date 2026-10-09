// 놀이방(2026-10-09 사용자 요청 "방이 더 있으면, 친구들과 놀 수 있는 방, 친구 초대", 디자인·아동 심리 자문 2·3단계).
// "함께 사는 건 여럿, 돌보는 건 하나": 돌봄은 내 방에서만. 놀이방엔 마을 친구(시간 멈춘 손님)와 놀러 오기 코드로 온 손님이 놀러 온다.
// 손님은 쓰다듬기만, 숫자는 안 바뀜. 지금 친구와 '같이 놀기'는 하루 한 번 기분 +10(돌봄이 필요하면 안 됨).
import { memberCanvas } from "../render/screen.js?v=052c180-1791549664";
import { drawPlay } from "../render/deco.js?v=052c180-1791549664";
import { lookOf } from "../render/creature.js?v=052c180-1791549664";
import { currentKey } from "./collection.js?v=052c180-1791549664";
import { villageOf, careBlock } from "../core/village.js?v=052c180-1791549664";
import { visitCode, addVisitor, pruneVisitors, readVisit, showVisit } from "../core/visit.js?v=052c180-1791549664";
import { josa } from "../core/josa.js?v=052c180-1791549664";

const W = 128, H = 112, FLOOR = 54;
const dayKey = (ts) => new Date(ts).toDateString();
const PLAY_MOOD = 10;
let open = null;

const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else if (k.startsWith("on")) e[k] = v; else e.setAttribute(k, v); } for (const c of kids) if (c != null) e.append(c); return e; };

// 놀이방에 있는 친구들: 지금 친구 + 마을 친구(최근 이사 순 최대 2) + 놀러 온 손님(최대 2)
function cast(profile, now) {
  const out = [];
  const p = profile.pet;
  if (p && !p.ended && p.stage !== "egg") out.push({ who: "me", name: p.name, key: currentKey(p), look: lookOf(p), sleep: !!p.asleep });
  for (const v of villageOf(profile).slice(-2).reverse()) if (v?.pet && v.pet.stage !== "egg") out.push({ who: "village", name: v.pet.name, key: currentKey(v.pet), look: lookOf(v.pet) });
  profile.visitors = pruneVisitors(profile.visitors, now);
  for (const x of profile.visitors) { const r = readVisit(x.code); if (r) out.push({ who: "guest", name: null, key: r.key, look: r.look }); }
  return out.slice(0, 5);
}

function drawScene(ctx, profile, list, t, hearts) {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#dff3ea"; ctx.fillRect(0, 0, W, FLOOR);
  ctx.fillStyle = "#c8ead9"; for (let y = 6; y < FLOOR - 4; y += 10) for (let x = (y / 10) % 2 ? 8 : 2; x < W; x += 12) ctx.fillRect(x, y, 2, 2);
  const cols = ["#ff8fab", "#ffd23f", "#7bdff2", "#b2f7a6", "#c3a6ff"]; // 위쪽 깃발
  for (let i = 0; i < 13; i++) { ctx.fillStyle = cols[i % cols.length]; const x = 2 + i * 10; ctx.fillRect(x, 3, 6, 2); ctx.fillRect(x + 1, 5, 4, 2); ctx.fillRect(x + 2, 7, 2, 1); }
  ctx.fillStyle = "#e8a37e"; ctx.fillRect(0, FLOOR - 3, W, 3);
  ctx.fillStyle = "#ffe2a8"; ctx.fillRect(0, FLOOR, W, H - FLOOR);
  ctx.fillStyle = "#f6cf86"; for (let y = FLOOR + 9; y < H; y += 11) ctx.fillRect(0, y, W, 1);
  const eq = profile.econ?.equipped || {};
  if (eq.playL) drawPlay(ctx, eq.playL, 24, FLOOR + 14, { now: t });
  if (eq.playM) drawPlay(ctx, eq.playM, 64, FLOOR + 10, { now: t });
  if (eq.playR) drawPlay(ctx, eq.playR, 104, FLOOR + 14, { now: t });
  if (!eq.playL && !eq.playM && !eq.playR) { ctx.fillStyle = "rgba(59,44,53,.35)"; ctx.font = "6px system-ui"; ctx.textAlign = "center"; ctx.fillText("상점 놀이방 탭에서 놀이 기구를 놓아 보세요", W / 2, FLOOR + 18); }
  const pos = [];
  list.forEach((c, i) => {
    const n = list.length, x = Math.round(((i + 0.5) / n) * W), hop = c.sleep ? 0 : Math.max(0, Math.round(Math.sin(t / 380 + i * 1.7) * 3));
    const cv = memberCanvas(c.key, c.look); const base = H - 6 - (i % 2) * 4;
    if (cv) ctx.drawImage(cv, x - 38, base - 48 - hop);
    if (c.sleep) { ctx.fillStyle = "#3b2c35"; ctx.font = "bold 7px system-ui"; ctx.fillText("z", x + 10, base - 30); }
    pos.push({ x, base, c });
  });
  for (const h of hearts) { const a = 1 - (t - h.at) / 1200; if (a <= 0) continue; ctx.globalAlpha = a; ctx.fillStyle = "#ff6b8b"; const y = h.y - (t - h.at) / 60; ctx.fillRect(h.x - 2, y, 2, 2); ctx.fillRect(h.x + 1, y, 2, 2); ctx.fillRect(h.x - 2, y + 2, 5, 2); ctx.fillRect(h.x - 1, y + 4, 3, 1); ctx.fillRect(h.x, y + 5, 1, 1); ctx.globalAlpha = 1; }
  return pos;
}

// deps: { profile, persist, say, sfx, now(), onChange() }
export function openPlayroom(deps) {
  if (open) return;
  const { profile, persist, say, sfx } = deps;
  const now = deps.now();
  const wrap = el("div", { class: "dexcard playroom" });
  const inner = el("div", { class: "dexcard-in" });
  const cv = el("canvas", { width: W, height: H, class: "pr-canvas" });
  const ctx = cv.getContext("2d");
  const line = el("p", { class: "small pr-line", text: "" });
  const hearts = [];
  let list = cast(profile, now), pos = [];
  const me = profile.pet && !profile.pet.ended && profile.pet.stage !== "egg" ? profile.pet : null;

  const close = () => { cancelAnimationFrame(open?.raf); wrap.remove(); open = null; deps.onChange?.(); };
  const x = el("button", { class: "x", text: "✕", "aria-label": "닫기", onclick: close });
  const desc = list.length > 1 ? `친구 ${list.length - (me ? 1 : 0)}명이 놀러 왔어요. 친구를 누르면 쓰다듬어요.` : "친구 마을 친구나 놀러 오기 코드로 온 친구가 여기서 놀아요.";
  line.textContent = desc;
  cv.onclick = (ev) => {
    const r = cv.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * W;
    const hit = pos.reduce((b, p) => (Math.abs(p.x - px) < Math.abs((b?.x ?? 1e9) - px) ? p : b), null);
    if (!hit || Math.abs(hit.x - px) > 20) return;
    hearts.push({ x: hit.x, y: hit.base - 34, at: performance.now() }); sfx("tap");
    line.textContent = hit.c.who === "guest" ? "놀러 온 친구가 좋아해요" : `${josa(hit.c.name || "친구", "이", "가")} 좋아해요`;
  };
  const today = dayKey(now);
  const played = profile.playroomDay === today;
  const playBtn = el("button", { class: "big", text: played ? "오늘은 같이 놀았어요" : `${me ? josa(me.name, "과", "와") : "친구와"} 같이 놀기 (하루 한 번, 기분 +${PLAY_MOOD})`, disabled: played || !me || list.length < 2 || undefined, onclick: () => {
    if (!me) return;
    if (me.asleep) { sfx("refuse"); line.textContent = `${josa(me.name, "이", "가")} 자고 있어요. 깨어 있을 때 같이 놀아요`; return; }
    const blk = careBlock(me);
    if (blk) { sfx("refuse"); line.textContent = `${josa(me.name, "이", "가")} ${blk}. 먼저 돌봐 준 뒤에 놀아요`; return; }
    me.stats.mood = Math.min(100, (me.stats.mood || 0) + PLAY_MOOD); profile.playroomDay = today; persist(); sfx("win");
    for (const p of pos) hearts.push({ x: p.x, y: p.base - 34, at: performance.now() });
    line.textContent = "다 같이 신나게 놀았어요!"; refreshBtn();
  } });
  const refreshBtn = () => {
    const done = profile.playroomDay === today, alone = list.length < 2;
    playBtn.disabled = !me || done || alone;
    playBtn.textContent = !me ? "알이 깨어나면 같이 놀 수 있어요" : done ? "오늘은 같이 놀았어요" : alone ? "같이 놀 친구가 오면 놀 수 있어요" : `${josa(me.name, "과", "와")} 같이 놀기 (하루 한 번, 기분 +${PLAY_MOOD})`;
  };
  refreshBtn();

  // 놀러 오기 코드: 내 코드 보여 주기 + 친구 코드 넣기(겉모습만, 서버 없음)
  const myCode = me ? visitCode(currentKey(me), lookOf(me)) : null;
  const inp = el("input", { class: "giftcode", placeholder: "숫자 6자리", maxlength: "7", inputmode: "numeric", pattern: "[0-9 ]*", autocomplete: "off" });
  const codeBox = el("details", { class: "giftbox" }, el("summary", { text: "놀러 오기 코드" }),
    el("p", { class: "small", text: myCode ? `내 놀러 오기 코드: ${showVisit(myCode)}` : "아기 이상으로 자라면 내 코드가 생겨요" }),
    myCode ? el("button", { class: "link", text: "코드 복사", onclick: () => navigator.clipboard?.writeText(myCode).then(() => (line.textContent = "코드를 복사했어요"), () => {}) }) : null,
    el("p", { class: "fine", text: "코드에는 겉모습만 담겨요(이름·글은 없어요). 친구가 넣으면 내 친구 모습이 하루 동안 그 친구 놀이방에 놀러 가요." }),
    el("div", { class: "row", style: "gap:8px;margin-top:6px" }, inp, el("button", { class: "krw", text: "부르기", onclick: () => {
      const r = addVisitor(profile.visitors, inp.value, deps.now());
      if (!r.ok) { sfx("refuse"); line.textContent = r.reason === "here" ? "이미 놀러 와 있어요" : "숫자 6자리를 다시 확인해 주세요"; return; }
      profile.visitors = r.list; persist(); sfx("happy"); inp.value = ""; list = cast(profile, deps.now()); line.textContent = "친구가 놀러 왔어요! 하루 동안 있다가 집에 가요";
      refreshBtn();
    } })));
  inner.append(x, el("h3", { text: "놀이방" }), cv, line, playBtn, codeBox);
  wrap.append(inner); document.body.append(wrap);
  const loop = (t) => { pos = drawScene(ctx, profile, list, t, hearts); if (open) open.raf = requestAnimationFrame(loop); };
  open = { raf: requestAnimationFrame(loop) };
}
