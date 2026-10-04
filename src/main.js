// 부팅 순서는 이 파일 한 곳에서만 정해요.
// (지난 게임에서 파일 읽는 순서 때문에 저장 기본값이 빠지는 버그가 있었어요.)
// 순서: 저장 불러오기 → 꺼져 있던 시간 계산 → 화면 시작 → 서비스 워커·알림 확인 → 알림 일정 올리기
import { createPet } from "./core/state.js?v=0d5f74b-1791117259";
import { advance, feed, play, wash, cleanPoop, toggleLight, giveMedicine } from "./core/sim.js?v=0d5f74b-1791117259";
import { predictNotifications } from "./core/notify.js?v=0d5f74b-1791117259";
import { josa } from "./core/josa.js?v=0d5f74b-1791117259";
import { drawRoom, drawIcon } from "./render/screen.js?v=0d5f74b-1791117259";
import { createAnimator, play as playAnim, frame as animFrame, addFx } from "./render/anim.js?v=0d5f74b-1791117259";
import { formKey, lookOf } from "./render/creature.js?v=0d5f74b-1791117259";
import { createFacePicker, pickFace } from "./render/face.js?v=0d5f74b-1791117259";
import { SPRITES } from "./render/sprites.js?v=0d5f74b-1791117259";
import { loadProfile, saveProfile, freshProfile } from "./app/store.js?v=0d5f74b-1791117259";
import { deviceInfo, registerSW, enablePush, ensurePush, uploadSchedule, sendTest, serverStatus } from "./app/push.js?v=0d5f74b-1791117259";

const clock = { offset: 0, now() { return Date.now() + this.offset; } }; // offset은 개발 도구만 바꾼다

const DOT_WIDTH = 128;
const $ = (id) => document.getElementById(id);
const stage = $("stage"), canvas = $("room"), ctx = canvas.getContext("2d");
let view = { w: DOT_WIDTH, h: 200 };
const QS = new URLSearchParams(location.search);
if (QS.has("dev") && QS.has("reset")) { localStorage.clear(); history.replaceState(null, "", location.pathname + "?dev"); } // 개발용 초기화
let profile = loadProfile();
const anim = createAnimator();
const faces = createFacePicker();
let petBox = null; // 마지막으로 그린 펫 위치(쓰다듬기 판정용)
let poopRects = []; // 마지막으로 그린 똥 위치(톡 치우기 판정용)
let lookCache = { key: "", look: null };
const I = (n) => josa(n, "이", "가");

// ---------- 화면 크기 ----------
function fitCanvas() {
  const rect = stage.getBoundingClientRect();
  const scale = Math.max(1, Math.round(rect.width / DOT_WIDTH)); // 정수배라야 도트가 안 뭉개져요
  const w = Math.floor(rect.width / scale), h = Math.floor(rect.height / scale);
  canvas.width = w; canvas.height = h;
  canvas.style.width = `${w * scale}px`; canvas.style.height = `${h * scale}px`;
  view = { w, h };
  ctx.imageSmoothingEnabled = false;
}

// ---------- 알림 문구 ----------
let msgUntil = 0;
function say(text, ms = 4000) {
  $("msg").textContent = text;
  msgUntil = ms ? Date.now() + ms : 0;
}

function statusLine() {
  const p = profile.pet;
  if (!p) return "";
  const n = p.name;
  if (p.stage === "egg") return "알이 곧 깨어나요";
  if (p.asleep) return p.lightOn ? `${I(n)} 자고 있어요. 불을 꺼 주세요` : `${I(n)} 쿨쿨 자고 있어요`;
  if (p.sick) return `${I(n)} 아파요. 약이 필요해요`;
  if (p.stats.hunger <= 0) return `${I(n)} 배고파서 울고 있어요`;
  if (p.stats.mood <= 0) return `${I(n)} 심심해서 울고 있어요`;
  if (p.stats.hunger <= 20) return `${I(n)} 배고파요`;
  if (p.poops >= 2) return "똥을 톡 눌러 치워 주세요";
  if (p.stats.mood <= 20) return `${I(n)} 놀아 달래요`;
  if (p.napLeft > 0) return `${I(n)} 낮잠 자는 중`;
  if (p.poops === 1) return "똥을 톡 눌러 치워 주세요";
  if (p.stats.clean <= 30) return `${I(n)} 꼬질꼬질해요. 씻겨 주세요`;
  if (p.stats.hunger < 50 && p.stats.mood < 50) return `${I(n)} 출출하고 심심해요`;
  if (p.stats.hunger < 50) return `${I(n)} 조금 출출해요`;
  if (p.stats.mood < 50) return `${I(n)} 조금 심심해요`;
  return `${I(n)} 기분이 좋아요`;
}

const STAGE_KO = { egg: "알", baby: "아기", child: "어린이", teen: "청소년", adult: "어른" };
const BRANCH_KO = { good: "좋음", normal: "보통", A: "모범형", B: "통통형", C: "자유형", D: "장난꾸러기형" };

function summarize(events) {
  const c = {};
  for (const e of events) c[e.type] = (c[e.type] || 0) + 1;
  const parts = [];
  if (c.hatch) parts.push("알이 깨어났어요");
  if (c.evolve) parts.push(`${I(STAGE_KO[profile.pet.stage])} 됐어요`);
  if (c.poop) parts.push(`똥 ${c.poop}번`);
  if (c.crying) parts.push("울었어요");
  if (c.sick) parts.push("아팠어요");
  if (c.nap) parts.push(`낮잠 ${c.nap}번`);
  if (c.mistake) parts.push(`돌봄 실수 ${c.mistake}번`);
  return parts.join(", ");
}

// ---------- 상태 표시 ----------
function renderStats() {
  const p = profile.pet;
  const box = $("stats");
  if (!p) { box.innerHTML = ""; $("petname").textContent = "포켓 펫"; $("sub").textContent = ""; return; }
  const rows = [["배부름", "hunger"], ["기분", "mood"], ["깨끗함", "clean"], ["기운", "energy"], ["건강", "health"]];
  box.innerHTML = rows.map(([label, k]) => {
    const v = Math.round(p.stats[k]);
    const cls = v <= 20 ? "low" : v <= 50 ? "mid" : "";
    return `<div class="stat ${cls}"><span>${label}</span><b>${v}</b><i style="width:${v}%"></i></div>`;
  }).join("");
  const age = (p.ageMin / 1440).toFixed(1);
  $("sub").textContent = `${STAGE_KO[p.stage]}${p.branch ? `(${BRANCH_KO[p.branch]})` : ""} · ${age}살 · ${p.weight}g · 실수 ${p.mistakes.total}`;
  $("petname").textContent = p.name;
  $("btn-light").querySelector("span").textContent = p.lightOn ? "불 끄기" : "불 켜기";
}

// ---------- 저장 + 알림 일정 ----------
let syncTimer = 0;
function persist() { saveProfile(profile); }
function scheduleSync(delay = 2500) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(), delay);
}
async function syncNow({ keepalive = false } = {}) {
  if (!profile.pet || !profile.push.subscribed) return;
  try {
    const { notes } = predictNotifications(profile.pet, clock.now(), profile.settings);
    await uploadSchedule(profile.deviceId, notes, { keepalive });
    profile.push.lastSync = Date.now(); profile.push.nextAt = notes[0]?.at || null; persist();
  } catch (e) { console.warn("알림 일정 올리기 실패", e); }
}

// ---------- 돌봄 행동 ----------
const REFUSE = {
  egg: "아직 알이에요", asleep: "자고 있어요. 깨면 해 주세요", full: "배불러서 안 먹는대요",
  tired: "너무 지쳐서 못 논대요. 좀 쉬게 해 주세요", "not-sick": "안 아픈데 약을 줘서 싫어해요",
};
// 행동 → 애니메이션: anims(결과) 가 재생할 애니메이션 이름과 데이터를 돌려준다
function act(fn, okText, anims) {
  const p = profile.pet; if (!p) return;
  const before = { poops: p.poops, lightOn: p.lightOn, sick: p.sick };
  const r = fn(p, clock.now());
  handleEvents(r.events);
  const t = performance.now();
  if (r.ok) { say(okText(p, r)); const [name, data] = anims(r, before); if (name) playAnim(anim, name, t, data); setTimeout(() => pickFace(faces, profile.pet, performance.now(), { force: true }), 1800); }
  else {
    say(REFUSE[r.reason] || "지금은 안 된대요");
    if (r.reason === "asleep") playAnim(anim, "sleepyRefuse", t);
    else if (r.reason === "not-sick") playAnim(anim, "medicine", t, { bitter: true });
    else if (r.reason !== "egg") playAnim(anim, "refuse", t);
  }
  renderStats(); persist(); scheduleSync();
}
const S = () => profile.settings;
const ACTIONS = {
  food: () => openSheet("food"),
  meal: () => { closeSheet(); act((p, t) => feed(p, "meal", t, S()), (p) => `${I(p.name)} 냠냠 먹었어요`, () => ["meal"]); },
  snack: () => { closeSheet(); act((p, t) => feed(p, "snack", t, S()), (p) => `${I(p.name)} 간식을 좋아해요`, () => ["snack"]); },
  play: () => {
    const win = Math.random() < 0.7;
    act((p, t) => play(p, t, S(), { win }), (p) => (win ? `${josa(p.name, "과", "와")} 신나게 놀았어요` : `${josa(p.name, "과", "와")} 놀았어요. 아깝게 졌어요`), () => ["play", { win }]);
  },
  wash: () => act((p, t) => wash(p, t, S()), (p) => (p.poops ? "뽀득뽀득 깨끗해졌어요. 바닥의 똥은 톡 눌러 치워요" : "뽀득뽀득 깨끗해졌어요"), () => ["wash"]),
  light: () => act((p, t) => toggleLight(p, t, S()), (p) => (p.lightOn ? "불을 켰어요" : "불을 껐어요"), (r) => [r.lightOn ? "lightOn" : "lightOff"]),
  medicine: () => act((p, t) => giveMedicine(p, t, S()), (p) => (p.sick ? "약을 먹었어요. 한 번 더 필요해요" : "다 나았어요"), () => ["medicine"]),
};

const PREV_STAGE = { baby: "egg", child: "baby", teen: "child", adult: "teen" };
function handleEvents(events) {
  const t = performance.now();
  for (const e of events) {
    const th = profile.pet.theme;
    if (e.type === "hatch") { say(`알이 깨어났어요! ${josa(profile.pet.name, "이에요", "예요")}`, 6000); playAnim(anim, "hatch", t, { eggKey: `${th}.egg` }); }
    if (e.type === "evolve") {
      const prevBranch = e.stage === "adult" ? (e.branch === "A" || e.branch === "B" ? "good" : "normal") : null;
      say(`${I(profile.pet.name)} ${I(STAGE_KO[e.stage])} 됐어요!`, 6000);
      playAnim(anim, "evolve", t, { fromKey: formKey(th, PREV_STAGE[e.stage], prevBranch), toKey: formKey(th, e.stage, e.branch) });
      setTimeout(() => pickFace(faces, profile.pet, performance.now(), { force: true }), 3200);
    }
    if (e.type === "poop") { if (!anim.cur) playAnim(anim, "poop", t); if (!profile.pet.asleep) say("똥을 쌌어요. 톡 눌러 치워 주세요", 5000); }
  }
}

// 펫을 톡 건드리면 쓰다듬기
// 똥 자리 관리(화면용): 몇 번째 자리에 똥이 있는지. 톡 누른 그 똥이 사라지게 한다.
function syncPoopSlots() {
  const p = profile.pet;
  profile.ui = profile.ui || { poopSlots: [] };
  const slots = profile.ui.poopSlots;
  const n = p ? p.poops : 0;
  while (slots.length > n) slots.pop();
  while (slots.length < n) { const free = [0, 1, 2, 3].find((i) => !slots.includes(i)); slots.push(free ?? 0); }
  return slots;
}

function onTap(ev) {
  const p = profile.pet; if (!p) return;
  const r = canvas.getBoundingClientRect();
  const x = ((ev.clientX - r.left) / r.width) * canvas.width, y = ((ev.clientY - r.top) / r.height) * canvas.height;
  // 똥을 먼저 본다(누르기 쉽게 여유 6px)
  const hit = poopRects.find((pr) => x >= pr.x - 6 && x <= pr.x + pr.w + 6 && y >= pr.y - 6 && y <= pr.y + pr.h + 6);
  if (hit) {
    const res = cleanPoop(p, clock.now(), S());
    if (res.ok) {
      const slots = syncPoopSlots();
      const i = slots.indexOf(hit.slot); if (i >= 0) slots.splice(i, 1);
      slots.length = p.poops; // 혹시 어긋나면 맞춤
      addFx(anim, "poof", hit.x + hit.w / 2, hit.y + hit.h / 2, performance.now());
      if (!p.asleep && !anim.cur) playAnim(anim, "tidy", performance.now());
      say(p.poops ? `똥을 치웠어요. ${p.poops}개 남았어요` : "똥을 다 치웠어요", 2500);
      renderStats(); persist(); scheduleSync();
    }
    return;
  }
  if (!petBox) return;
  const m = 8;
  if (x < petBox.x - m || x > petBox.x + petBox.w + m || y < petBox.y - m || y > petBox.y + petBox.h + m) return;
  if (p.asleep) { playAnim(anim, "sleepyRefuse", performance.now()); say(`${I(p.name)} 자고 있어요. 쉿!`); return; }
  playAnim(anim, "pet", performance.now());
  say(`${josa(p.name, "을", "를")} 쓰다듬었어요`, 2500);
}

// ---------- 시작 화면 ----------
const draft = { theme: null, speed: "normal" };
function showStart() {
  $("start").hidden = false;
  stepTo("theme");
}
function stepTo(step) {
  for (const el of document.querySelectorAll("#start .step")) el.hidden = el.dataset.step !== step;
  if (step === "name") setTimeout(() => $("name-input").focus(), 50);
}
function startGame() {
  const name = $("name-input").value.trim().slice(0, 6) || (draft.theme === "fantasy" ? "말랑이" : "토리");
  const now = clock.now();
  profile.pet = createPet({ now, seed: (Math.random() * 2 ** 32) >>> 0, theme: draft.theme, speed: draft.speed, name });
  persist();
  $("start").hidden = true;
  say(`${name}의 알이에요. 곧 깨어나요`, 6000);
  renderStats(); scheduleSync(500);
  if (!profile.seenGuide) setTimeout(() => openSheet("notify"), 1200);
}

// ---------- 메뉴(설정·알림) ----------
function openSheet(name) {
  for (const el of document.querySelectorAll(".sheet")) el.hidden = el.dataset.sheet !== name;
  $("backdrop").hidden = false;
  if (name === "notify") renderNotify();
  if (name === "settings") renderSettings();
}
function closeSheet() {
  for (const el of document.querySelectorAll(".sheet")) el.hidden = true;
  $("backdrop").hidden = true;
}

function renderNotify() {
  profile.seenGuide = true; persist();
  const d = deviceInfo();
  const box = $("notify-body");
  let html = "";
  if (d.ios && !d.standalone) {
    html += `<p class="warn">iPhone은 <b>홈 화면에 추가</b>해야 알림이 와요.</p>
      <ol><li>사파리 아래쪽 <b>공유 버튼</b>(네모에 위쪽 화살표)을 눌러요</li><li><b>홈 화면에 추가</b>를 눌러요</li><li>홈 화면에 생긴 <b>포켓 펫</b> 아이콘으로 다시 열어요</li><li>거기서 ≡ 메뉴 → <b>알림</b> → <b>알림 받기</b>를 눌러요</li></ol>
      <p class="small">지금 키우던 펫은 홈 화면 앱으로 옮겨지지 않아요(저장소가 따로예요). 홈 화면 앱에서 새로 시작해 주세요.</p>`;
    if (d.iosVer[0] && (d.iosVer[0] < 16 || (d.iosVer[0] === 16 && d.iosVer[1] < 4))) html += `<p class="warn">iOS 16.4 이상이 필요해요. 지금 iOS ${d.iosVer.join(".")}</p>`;
  } else if (!d.supported) {
    html += `<p class="warn">이 브라우저는 알림을 지원하지 않아요. ${d.android ? "크롬으로 열어 주세요." : ""}</p>`;
  } else {
    const on = profile.push.subscribed && d.permission === "granted";
    if (on) {
      html += `<p class="ok" id="push-state">알림 켜짐 · 서버 연결 확인 중...</p>`;
      html += `<button class="big" id="btn-test">시험 알림 보내기 (1분 뒤)</button><p class="small">누른 뒤 앱을 닫고(홈으로 나가기) 1~2분 기다려 보세요.</p>`;
      html += `<button class="big ghost" id="btn-enable">알림이 안 오면: 연결 새로 하기</button>`;
    } else {
      html += `<p>상태: <b>${d.permission === "denied" ? "알림 막힘(휴대폰 설정에서 이 앱의 알림을 허용해 주세요)" : "아직 안 켬"}</b></p>`;
      html += `<button class="big" id="btn-enable">알림 받기</button>`;
    }
    if (d.android && !d.standalone) html += `<p class="small">크롬 메뉴(⋮) → <b>홈 화면에 추가</b>(또는 앱 설치)를 하면 앱처럼 열려요.</p>`;
  }
  html += `<p class="small dim">기기 ID ${profile.deviceId.slice(0, 8)} · ${d.ios ? "iPhone" : d.android ? "안드로이드" : "기타"} · ${d.standalone ? "홈 화면 앱" : "브라우저"}</p>`;
  box.innerHTML = html;
  if (profile.push.subscribed && d.permission === "granted") {
    serverStatus(profile.deviceId).then((st) => {
      const el = $("push-state"); if (!el) return;
      if (!st.subscribed) { el.className = "warn"; el.textContent = "서버에 이 휴대폰이 등록돼 있지 않아요. 아래 '연결 새로 하기'를 눌러 주세요"; return; }
      const next = st.next && st.next[0] ? new Date(st.next[0].at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
      const last = st.log && st.log[0];
      el.textContent = `알림 켜짐 · 서버 연결됨${next ? ` · 다음 알림 ${next}` : ""}${last ? ` · 마지막 전송 ${last.status === 201 || last.status === 200 ? "성공" : "실패(" + (last.status || last.note) + ")"}` : ""}`;
    }).catch(() => { const el = $("push-state"); if (el) { el.className = "warn"; el.textContent = "알림 켜짐 · 서버에 닿지 않아요(인터넷 연결을 확인해 주세요)"; } });
  }
  $("btn-enable")?.addEventListener("click", async () => {
    say("알림을 켜는 중...", 0);
    try {
      await enablePush(profile.deviceId);
      profile.push.subscribed = true; persist();
      await syncNow();
      say("알림을 켰어요. 시험 알림으로 확인해 보세요", 8000);
    } catch (e) { say(e.message || "알림을 켜지 못했어요", 8000); }
    renderNotify();
  });
  $("btn-test")?.addEventListener("click", async () => {
    try { await sendTest(profile.deviceId, 60); say("1분 뒤 시험 알림이 와요. 앱을 닫고 기다려 보세요", 10000); }
    catch (e) { say("시험 알림 예약 실패: " + e.message, 8000); }
  });
}

function renderSettings() {
  const s = profile.settings, p = profile.pet;
  const box = $("settings-body");
  box.innerHTML = `
    <label>속도 <select id="set-speed">
      <option value="slow">느긋 (어른까지 약 6일, 하루 1~2번)</option>
      <option value="normal">보통 (약 3일, 하루 3~4번)</option>
      <option value="fast">빠름 (약 1일, 2시간마다)</option></select></label>
    <label>잠자는 시간 <span class="row"><input type="time" id="set-sleep-start" value="${s.sleep.start}"> ~ <input type="time" id="set-sleep-end" value="${s.sleep.end}"></span></label>
    <label class="check"><input type="checkbox" id="set-busy" ${s.busy.enabled ? "checked" : ""}> 바쁜 시간 (평일, 수치가 절반 속도로 줄어요)</label>
    <label>바쁜 시간 <span class="row"><input type="time" id="set-busy-start" value="${s.busy.start}"> ~ <input type="time" id="set-busy-end" value="${s.busy.end}"></span></label>
    <label class="check"><input type="checkbox" id="set-urgent" ${s.notify.busyOnlyUrgent ? "checked" : ""}> 바쁜 시간에는 급한 알림만</label>
    <label class="check"><input type="checkbox" id="set-notify" ${s.notify.enabled ? "checked" : ""}> 알림 보내기</label>
    <p class="small dim">끝 방식(계속 살기·여행·원작)은 알파(M4)에서 들어가요.</p>
    <button class="big ghost danger" id="btn-reset">처음부터 다시</button>`;
  if (p) $("set-speed").value = p.speed;
  const save = () => {
    if (profile.pet) advance(profile.pet, clock.now(), s); // 바꾸기 전 설정으로 지금까지 계산
    s.sleep.start = $("set-sleep-start").value || s.sleep.start;
    s.sleep.end = $("set-sleep-end").value || s.sleep.end;
    s.busy.enabled = $("set-busy").checked;
    s.busy.start = $("set-busy-start").value || s.busy.start;
    s.busy.end = $("set-busy-end").value || s.busy.end;
    s.notify.busyOnlyUrgent = $("set-urgent").checked;
    s.notify.enabled = $("set-notify").checked;
    if (profile.pet) profile.pet.speed = $("set-speed").value;
    persist(); renderStats(); scheduleSync(300);
  };
  for (const el of box.querySelectorAll("input,select")) el.addEventListener("change", save);
  $("btn-reset").addEventListener("click", () => {
    if (!confirm("지금 펫과 기록을 지우고 처음부터 시작할까요?")) return;
    const keep = { deviceId: profile.deviceId, push: profile.push, settings: profile.settings, seenGuide: true };
    profile = { ...freshProfile(), ...keep };
    persist(); closeSheet(); showStart(); renderStats();
    uploadSchedule(profile.deviceId, []).catch(() => {});
  });
}

// ---------- 그리기 루프 ----------
function frame() {
  const p = profile.pet;
  const t = performance.now();
  let scene;
  if (p) {
    const lk = `${p.bornAt}|${p.weight}|${p.mistakes.total}`;
    if (lookCache.key !== lk) lookCache = { key: lk, look: lookOf(p) };
    scene = { stage: p.stage, branch: p.branch, theme: p.theme, poops: p.poops, poopSlots: syncPoopSlots(), asleep: p.asleep, lightOn: p.lightOn, sick: p.sick, mood: p.stats.mood, hunger: p.stats.hunger, napping: p.napLeft > 0, look: lookCache.look, face: pickFace(faces, p, t) };
  } else scene = { stage: "egg", theme: "animal", lightOn: true, mood: 100, hunger: 100, poopSlots: [] };
  const fr = animFrame(anim, t, scene, { roam: Math.min(26, Math.round(view.w * 0.18)) });
  const drawn = drawRoom(ctx, { ...view, now: t, scene, f: fr });
  petBox = drawn.pet; poopRects = drawn.poops;
  const d = new Date(clock.now());
  $("clock").textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  requestAnimationFrame(frame);
}

function tick() {
  const p = profile.pet;
  if (!p) return;
  const before = p.lastTickAt;
  const events = advance(p, clock.now(), profile.settings);
  if (p.lastTickAt !== before) {
    handleEvents(events);
    renderStats(); persist();
    if (events.length) scheduleSync(5000);
  }
  if (Date.now() > msgUntil) $("msg").textContent = statusLine();
}

// ---------- 시작 ----------
function boot() {
  for (const btn of document.querySelectorAll("[data-icon]")) drawIcon(btn.querySelector("canvas"), SPRITES[btn.dataset.icon]);
  for (const btn of document.querySelectorAll("[data-act]")) btn.addEventListener("click", () => ACTIONS[btn.dataset.act]());
  for (const btn of document.querySelectorAll("[data-theme]")) btn.addEventListener("click", () => { draft.theme = btn.dataset.theme; stepTo("speed"); });
  for (const btn of document.querySelectorAll("[data-speed]")) btn.addEventListener("click", () => { draft.speed = btn.dataset.speed; stepTo("name"); });
  $("btn-start").addEventListener("click", startGame);
  $("name-input").addEventListener("keydown", (e) => { if (e.key === "Enter") startGame(); });
  $("btn-menu").addEventListener("click", () => openSheet("menu"));
  $("backdrop").addEventListener("click", closeSheet);
  for (const btn of document.querySelectorAll("[data-open]")) btn.addEventListener("click", () => openSheet(btn.dataset.open));
  for (const btn of document.querySelectorAll("[data-close]")) btn.addEventListener("click", closeSheet);

  canvas.addEventListener("pointerdown", onTap);
  new ResizeObserver(fitCanvas).observe(stage);
  fitCanvas();

  // 꺼져 있던 동안의 일 계산
  const fromPush = QS.get("from") === "push";
  if (fromPush) history.replaceState(null, "", location.pathname + (QS.has("dev") ? "?dev" : ""));
  if (profile.pet) {
    const away = Date.now() - (profile.lastSeen || Date.now());
    const events = advance(profile.pet, clock.now(), profile.settings);
    persist();
    const sum = summarize(events);
    if (sum) say(`자리를 비운 동안: ${sum}`, 9000);
    pickFace(faces, profile.pet, performance.now(), { force: true });
    if (profile.pet.stage !== "egg" && !profile.pet.asleep && (fromPush || away >= 2 * 3600 * 1000)) {
      setTimeout(() => { if (!anim.cur) { playAnim(anim, fromPush ? "greetBig" : "greet", performance.now()); if (!sum) say(fromPush ? `와 줬구나! ${I(profile.pet.name)} 기다렸어요` : `${I(profile.pet.name)} 반가워해요`, 5000); } }, 700);
    }
  } else {
    showStart();
  }
  renderStats();
  tick();
  requestAnimationFrame(frame);
  setInterval(tick, 1000);

  // 앱을 닫거나 다른 앱으로 갈 때 일정 올리기
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { profile.lastSeen = Date.now(); persist(); syncNow({ keepalive: true }); }
    else { tick(); navigator.clearAppBadge?.().catch(() => {}); }
  });
  navigator.clearAppBadge?.().catch(() => {});
  setInterval(() => syncNow(), 10 * 60 * 1000);
  setInterval(() => { if (document.visibilityState === "visible") profile.lastSeen = Date.now(); }, 30000);
  // 알림을 눌러서 앱이 앞으로 나오면 크게 반기기(서비스 워커가 알려 줌)
  navigator.serviceWorker?.addEventListener("message", (ev) => {
    if (ev.data?.type === "push-click" && profile.pet && profile.pet.stage !== "egg" && !profile.pet.asleep) {
      playAnim(anim, "greetBig", performance.now()); say(`와 줬구나! ${I(profile.pet.name)} 기다렸어요`, 5000);
    }
  });

  // 서비스 워커·알림 연결 확인
  registerSW().then(async () => {
    if (profile.push.subscribed) {
      try { await ensurePush(profile.deviceId); await syncNow(); } catch (e) { console.warn(e); }
    }
  });

  // 개발 도구(공개 배포에는 없음): ?dev 로 열기
  if (QS.has("dev")) {
    window.__pp = { clock, getProfile: () => profile, tick, anim, playAnim: (n, d) => playAnim(anim, n, performance.now(), d) };
    import("./dev/panel.js?v=0d5f74b-1791117259").then((m) => m.mount({ clock, getProfile: () => profile, tick, renderStats, syncNow, serverStatus })).catch(() => {});
  }
}

boot();
