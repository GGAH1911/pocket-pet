// 부팅 순서는 이 파일 한 곳에서만 정해요.
// (지난 게임에서 파일 읽는 순서 때문에 저장 기본값이 빠지는 버그가 있었어요.)
// 순서: 저장 불러오기 → 꺼져 있던 시간 계산 → 화면 시작 → 서비스 워커·알림 확인 → 알림 일정 올리기
import { createPet } from "./core/state.js?v=0a4f52f-1791114689";
import { advance, feed, play, wash, toggleLight, giveMedicine } from "./core/sim.js?v=0a4f52f-1791114689";
import { predictNotifications } from "./core/notify.js?v=0a4f52f-1791114689";
import { josa } from "./core/josa.js?v=0a4f52f-1791114689";
import { drawRoom, drawIcon } from "./render/screen.js?v=0a4f52f-1791114689";
import { SPRITES } from "./render/sprites.js?v=0a4f52f-1791114689";
import { loadProfile, saveProfile, freshProfile } from "./app/store.js?v=0a4f52f-1791114689";
import { deviceInfo, registerSW, enablePush, ensurePush, uploadSchedule, sendTest, serverStatus } from "./app/push.js?v=0a4f52f-1791114689";

const clock = { offset: 0, now() { return Date.now() + this.offset; } }; // offset은 개발 도구만 바꾼다

const DOT_WIDTH = 128;
const $ = (id) => document.getElementById(id);
const stage = $("stage"), canvas = $("room"), ctx = canvas.getContext("2d");
let view = { w: DOT_WIDTH, h: 200 };
let profile = loadProfile();
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
  if (p.poops >= 2) return "똥을 치워 주세요";
  if (p.stats.mood <= 20) return `${I(n)} 놀아 달래요`;
  if (p.napLeft > 0) return `${I(n)} 낮잠 자는 중`;
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
function act(fn, okText) {
  const p = profile.pet; if (!p) return;
  const r = fn(p, clock.now());
  handleEvents(r.events);
  if (r.ok) say(okText(p, r)); else say(REFUSE[r.reason] || "지금은 안 된대요");
  renderStats(); persist(); scheduleSync();
}
const S = () => profile.settings;
const ACTIONS = {
  food: () => openSheet("food"),
  meal: () => { closeSheet(); act((p, t) => feed(p, "meal", t, S()), (p) => `${I(p.name)} 냠냠 먹었어요`); },
  snack: () => { closeSheet(); act((p, t) => feed(p, "snack", t, S()), (p) => `${I(p.name)} 간식을 좋아해요`); },
  play: () => act((p, t) => play(p, t, S(), { win: Math.random() < 0.7 }), (p) => `${josa(p.name, "과", "와")} 신나게 놀았어요`),
  wash: () => act((p, t) => wash(p, t, S()), () => "깨끗해졌어요"),
  light: () => act((p, t) => toggleLight(p, t, S()), (p) => (p.lightOn ? "불을 켰어요" : "불을 껐어요")),
  medicine: () => act((p, t) => giveMedicine(p, t, S()), (p) => (p.sick ? "약을 먹었어요. 한 번 더 필요해요" : "다 나았어요")),
};

function handleEvents(events) {
  for (const e of events) {
    if (e.type === "hatch") say(`알이 깨어났어요! ${josa(profile.pet.name, "이에요", "예요")}`, 6000);
    if (e.type === "evolve") say(`${I(profile.pet.name)} ${I(STAGE_KO[e.stage])} 됐어요!`, 6000);
  }
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
    html += `<p>상태: <b>${on ? "알림 받는 중" : d.permission === "denied" ? "알림 막힘(휴대폰 설정에서 허용해 주세요)" : "아직 안 켬"}</b></p>`;
    html += `<button class="big" id="btn-enable">${on ? "알림 다시 연결" : "알림 받기"}</button>`;
    if (on) {
      html += `<button class="big ghost" id="btn-test">시험 알림 (1분 뒤)</button><p class="small">누른 뒤 앱을 닫고(홈으로 나가기) 1~2분 기다려 보세요.</p>`;
      if (profile.push.nextAt) html += `<p class="small">다음 알림 예정: ${new Date(profile.push.nextAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>`;
    }
    if (d.android && !d.standalone) html += `<p class="small">크롬 메뉴(⋮) → <b>홈 화면에 추가</b>(또는 앱 설치)를 하면 앱처럼 열려요.</p>`;
  }
  html += `<p class="small dim">기기 ID ${profile.deviceId.slice(0, 8)} · ${d.ios ? "iPhone" : d.android ? "안드로이드" : "기타"} · ${d.standalone ? "홈 화면 앱" : "브라우저"}</p>`;
  box.innerHTML = html;
  $("btn-enable")?.addEventListener("click", async () => {
    say("알림을 켜는 중...", 0);
    try {
      await enablePush(profile.deviceId);
      profile.push.subscribed = true; persist();
      await syncNow();
      say("알림을 켰어요");
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
  const scene = p ? { stage: p.stage, theme: p.theme, poops: p.poops, asleep: p.asleep, lightOn: p.lightOn, sick: p.sick, mood: p.stats.mood, napping: p.napLeft > 0 } : { stage: "egg" };
  drawRoom(ctx, { ...view, now: clock.now(), scene });
  const t = new Date(clock.now());
  $("clock").textContent = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
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

  new ResizeObserver(fitCanvas).observe(stage);
  fitCanvas();

  // 꺼져 있던 동안의 일 계산
  if (profile.pet) {
    const events = advance(profile.pet, clock.now(), profile.settings);
    persist();
    const sum = summarize(events);
    if (sum) say(`자리를 비운 동안: ${sum}`, 9000);
  } else {
    showStart();
  }
  renderStats();
  tick();
  requestAnimationFrame(frame);
  setInterval(tick, 1000);

  // 앱을 닫거나 다른 앱으로 갈 때 일정 올리기
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { persist(); syncNow({ keepalive: true }); }
    else { tick(); navigator.clearAppBadge?.().catch(() => {}); }
  });
  navigator.clearAppBadge?.().catch(() => {});
  setInterval(() => syncNow(), 10 * 60 * 1000);

  // 서비스 워커·알림 연결 확인
  registerSW().then(async () => {
    if (profile.push.subscribed) {
      try { await ensurePush(profile.deviceId); await syncNow(); } catch (e) { console.warn(e); }
    }
  });

  // 개발 도구(공개 배포에는 없음): ?dev 로 열기
  if (new URLSearchParams(location.search).has("dev")) {
    import("./dev/panel.js?v=0a4f52f-1791114689").then((m) => m.mount({ clock, getProfile: () => profile, tick, renderStats, syncNow, serverStatus })).catch(() => {});
  }
}

boot();
