// 놀이방(2026-10-09 사용자 요청 "방이 더 있으면, 친구들과 놀 수 있는 방, 친구 초대", 디자인·아동 심리 자문 2·3단계).
// "함께 사는 건 여럿, 돌보는 건 하나": 돌봄은 내 방에서만. 놀이방엔 마을 친구(시간 멈춘 손님)와 놀러 오기 코드로 온 손님이 놀러 온다.
// 손님은 쓰다듬기만, 숫자는 안 바뀜. 지금 친구와 '같이 놀기'는 하루 한 번 기분 +10(돌봄이 필요하면 안 됨).
import { memberCanvas } from "../render/screen.js?v=5d8fb36-1791637734";
import { drawPlay } from "../render/deco.js?v=5d8fb36-1791637734";
import { lookOf } from "../render/creature.js?v=5d8fb36-1791637734";
import { currentKey } from "./collection.js?v=5d8fb36-1791637734";
import { villageOf, careBlock } from "../core/village.js?v=5d8fb36-1791637734";
import { visitCode, addVisitor, pruneVisitors, readVisit, showVisit } from "../core/visit.js?v=5d8fb36-1791637734";
import { josa } from "../core/josa.js?v=5d8fb36-1791637734";
import { planShow, poseAt, toyOpts, actAt, ACT_KO, SPOT, K, homeOf } from "./playshow.js?v=5d8fb36-1791637734";

const W = 256, H = 200, FLOOR = 96; // playshow.js PW·PH와 같음
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

function drawScene(ctx, profile, list, t, hearts, show = null) {
  const ms = show ? t - show.start : 0;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#dff3ea"; ctx.fillRect(0, 0, W, FLOOR);
  ctx.fillStyle = "#c8ead9"; for (let y = 16; y < FLOOR - 4; y += 12) for (let x = (y / 12) % 2 ? 9 : 3; x < W; x += 14) ctx.fillRect(x, y, 2, 2);
  const cols = ["#ff8fab", "#ffd23f", "#7bdff2", "#b2f7a6", "#c3a6ff"]; // 위쪽 깃발
  for (let i = 0; i < 25; i++) { ctx.fillStyle = cols[i % cols.length]; const x = 2 + i * 10; ctx.fillRect(x, 3, 6, 2); ctx.fillRect(x + 1, 5, 4, 2); ctx.fillRect(x + 2, 7, 2, 1); }
  ctx.fillStyle = "#e8a37e"; ctx.fillRect(0, FLOOR - 3, W, 3);
  ctx.fillStyle = "#ffe2a8"; ctx.fillRect(0, FLOOR, W, H - FLOOR);
  // 원근 바닥: 가로 줄은 앞으로 올수록 간격이 넓고, 세로 줄은 먼 곳(가운데 위)으로 모임
  ctx.fillStyle = "#f6cf86"; for (let y = FLOOR + 5, g = 5; y < H; g += 3, y += g) ctx.fillRect(0, y, W, 1);
  for (let k = -6; k <= 6; k++) { const xb = W / 2 + k * 44, xt = W / 2 + k * 14; for (let y = FLOOR; y < H; y += 1) { const f = (y - FLOOR) / (H - FLOOR); ctx.fillRect(Math.round(xt + (xb - xt) * f), y, 1, 1); } }
  ctx.fillStyle = "rgba(255,143,171,.28)"; for (let i = -18; i <= 18; i++) { const hw = Math.round(Math.sqrt(1 - (i / 19) ** 2) * 70); ctx.fillRect(128 - hw, 160 + i, hw * 2, 1); } // 가운데 동그란 놀이 매트
  const eq = profile.econ?.equipped || {};
  // 기구와 친구를 함께 '아래(가까운) 것이 앞'으로 정렬해 그린다(입체감)
  const items = [];
  const shadow = (x, base, rx) => { ctx.fillStyle = "rgba(120,80,40,.18)"; for (let i = -2; i <= 2; i++) { const hw = Math.round(Math.sqrt(1 - (i / 3) ** 2) * rx); ctx.fillRect(x - hw, base + i, hw * 2, 1); } };
  for (const slot of ["playL", "playM", "playR"]) if (eq[slot]) items.push({ base: SPOT[slot].base, draw: () => { shadow(SPOT[slot].x, SPOT[slot].base, 34); ctx.save(); ctx.translate(SPOT[slot].x, SPOT[slot].base); ctx.scale(K, K); drawPlay(ctx, eq[slot], 0, 0, { now: t, ...(show ? toyOpts(show.plan, slot, ms) : {}) }); ctx.restore(); } }); // 기구 2배
  const pos = [], fx = [];
  list.forEach((c, i) => {
    const n = list.length;
    let { x, base } = homeOf(i);
    let hop = c.sleep ? 0 : Math.max(0, Math.round(Math.sin(t / 380 + i * 1.7) * 3)), flip = false, clip = null, hidden = false;
    if (show) { // 같이 놀기 장면: 친구마다 자세
      const p = poseAt(show.plan, i, n, ms);
      x = Math.round(p.x); base = Math.round(p.base); hop = 0; flip = !!p.flip; clip = p.clip; hidden = !!p.hidden;
      if (p.heart && (!show.hAt[i] || t - show.hAt[i] > 600)) { show.hAt[i] = t; hearts.push({ x, y: base - 30, at: t }); }
      fx.push(() => { if (p.splash && Math.floor(t / 90) % 2 === 0) { const cols = ["#ff6b6b", "#ffd23f", "#7bdff2", "#b2f7a6"]; for (let k = 0; k < 3; k++) { ctx.fillStyle = cols[(k + Math.floor(t / 90)) % 4]; ctx.fillRect(x - 8 + ((k * 7 + Math.floor(t / 45)) % 17), (clip || base) - 4 - ((k * 5 + Math.floor(t / 60)) % 9), 2, 2); } } });
      fx.push(() => { if (p.whee) { ctx.fillStyle = "#ffffff"; ctx.fillRect(x - 20, base - 22, 5, 2); ctx.fillRect(x - 23, base - 14, 6, 2); } }); // 바람 줄
      fx.push(() => { if (p.peek) { ctx.fillStyle = "#3b2c35"; ctx.fillRect(x - 3, base - 14, 2, 2); ctx.fillRect(x + 2, base - 14, 2, 2); } }); // 텐트 안에서 눈만 반짝
    }
    const cv = memberCanvas(c.key, c.look);
    pos.push({ x, base, c });
    const cur = show ? actAt(show.plan, ms).act : null;
    const pz = show ? poseAt(show.plan, i, n, ms) : {};
    const onToy = cur && cur.slot && i < 2 && cur.kind !== "pool"; // 기구를 타는 친구는 기구 앞에(볼풀은 안에 들어가 몸이 가려지게 뒤에)
    const key = pz.inPool ? SPOT.playM.base - 1 : onToy ? Math.max(base, SPOT[cur.slot].base + 1) : base;
    if (cv && !hidden) items.push({ base: key, draw: () => {
      if (clip == null && base > FLOOR + 40 && (!onToy || base >= SPOT[cur.slot].base)) shadow(x, base + 1, 11);
      ctx.save();
      if (clip != null) { ctx.beginPath(); ctx.rect(0, 0, W, clip); ctx.clip(); }
      if (flip) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(cv, -38, base - 48 - hop); } else ctx.drawImage(cv, x - 38, base - 48 - hop);
      ctx.restore();
      if (c.sleep) { ctx.fillStyle = "#3b2c35"; const zx = x + 10, zy = base - 36; ctx.fillRect(zx, zy, 4, 1); ctx.fillRect(zx + 2, zy + 1, 1, 1); ctx.fillRect(zx + 1, zy + 2, 1, 1); ctx.fillRect(zx, zy + 3, 4, 1); } // 도트 z(글씨는 키우면 흐려짐)
    } });
  });
  items.sort((a, b) => a.base - b.base).forEach((it) => it.draw());
  fx.forEach((f) => f()); // 공 튀김·바람 줄·텐트 눈은 맨 위
  for (const h of hearts) { const a = 1 - (t - h.at) / 1200; if (a <= 0) continue; ctx.globalAlpha = a; ctx.fillStyle = "#ff6b8b"; const y = Math.round(h.y - (t - h.at) / 40), hx = Math.round(h.x); ctx.fillRect(hx - 4, y, 4, 4); ctx.fillRect(hx + 2, y, 4, 4); ctx.fillRect(hx - 4, y + 4, 10, 4); ctx.fillRect(hx - 2, y + 8, 6, 2); ctx.fillRect(hx, y + 10, 2, 2); ctx.globalAlpha = 1; }
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
  let show = null, round = 0;
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
    const bonus = profile.playroomDay !== today;
    if (bonus) { me.stats.mood = Math.min(100, (me.stats.mood || 0) + PLAY_MOOD); profile.playroomDay = today; persist(); } // 시작할 때 줌(중간에 닫아도 잃지 않게)
    const plan = planShow(profile.econ?.equipped || {}, round++);
    show = { plan, start: performance.now(), bonus, hAt: {}, lastAct: null };
    playBtn.disabled = true; playBtn.textContent = "노는 중…"; sfx("happy");
  } });
  const refreshBtn = () => {
    const done = profile.playroomDay === today, alone = list.length < 2;
    playBtn.disabled = !me || alone || !!show;
    playBtn.textContent = !me ? "알이 깨어나면 같이 놀 수 있어요" : alone ? "같이 놀 친구가 오면 놀 수 있어요" : done ? "또 같이 놀기 (기분은 하루 한 번 올라요)" : `${josa(me.name, "과", "와")} 같이 놀기 (기분 +${PLAY_MOOD}, 하루 한 번)`;
  };
  // 장면 끝: 기분 보너스(하루 한 번) + 다 같이 하트
  const finish = () => {
    const b = show.bonus; show = null;
    sfx("win"); for (const p of pos) hearts.push({ x: p.x, y: p.base - 34, at: performance.now() });
    line.textContent = b ? `다 같이 신나게 놀았어요! ${josa(me.name, "이", "가")} 기분 +${PLAY_MOOD}` : "다 같이 또 신나게 놀았어요!";
    refreshBtn();
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
  const eq = profile.econ?.equipped || {};
  const hint = !eq.playL && !eq.playM && !eq.playR ? el("p", { class: "fine", text: "상점 → 놀이방 탭에서 미끄럼틀·볼풀·그네 같은 놀이 기구를 놓을 수 있어요." }) : null;
  inner.append(x, el("h3", { text: "놀이방" }), cv, line, playBtn, hint, codeBox);
  wrap.append(inner); document.body.append(wrap);
  const loop = (t) => {
    if (show && t - show.start >= show.plan.total) finish();
    if (show) { const { act } = actAt(show.plan, t - show.start); if (act && act !== show.lastAct) { show.lastAct = act; line.textContent = `${ACT_KO[act.kind]}!`; } } // 막마다 제목
    pos = drawScene(ctx, profile, list, t, hearts, show);
    if (open) open.raf = requestAnimationFrame(loop);
  };
  open = { raf: requestAnimationFrame(loop) };
}
