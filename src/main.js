// 부팅 순서는 이 파일 한 곳에서만 정해요.
// (지난 게임에서 파일 읽는 순서 때문에 저장 기본값이 빠지는 버그가 있었어요.)
// 순서: 저장 불러오기 → 꺼져 있던 시간 계산 → 화면 시작 → 서비스 워커·알림 확인 → 알림 일정 올리기
import { createPet } from "./core/state.js?v=90736be-1791370074";
import { advance, feed, play, wash, walk, wakeFromNap, cleanPoop, toggleLight, giveMedicine, patPet, switchEndMode, retirePet } from "./core/sim.js?v=90736be-1791370074";
import { predictNotifications } from "./core/notify.js?v=90736be-1791370074";
import { josa } from "./core/josa.js?v=90736be-1791370074";
import { drawRoom, drawIcon, roomLayout } from "./render/screen.js?v=90736be-1791370074";
import { createAnimator, play as playAnim, frame as animFrame, addFx, DUR as ANIM_DUR } from "./render/anim.js?v=90736be-1791370074";
import { pickGame, createGame, GAME_NAMES } from "./app/games.js?v=90736be-1791370074";
import { EGGS, findEgg, createStreak, specialDay, SPECIAL_KO, HAT_OF, wishTime, MAKER_LETTER } from "./app/eggs.js?v=90736be-1791370074";
import { earn, buy, equip, unequip, grant as grantItem, gems, canAfford, dailyStatus, claimDaily, DAILY, THEME_UNLOCK, themeOpen } from "./core/economy.js?v=90736be-1791370074";
import { ITEMS, ITEM, SLOTS, TABS, PICKS, PACKS, SOON, BASIC_EQUIP, UNLOCK } from "./core/catalog.js?v=90736be-1791370074";
import { renderShop, renderDeco, dailyCard, spriteCanvas } from "./app/shop-ui.js?v=90736be-1791370074";
import { formKey, lookOf, FORMS as FORMS_REF, SPOT_COLORS, eggSpriteFor } from "./render/creature.js?v=90736be-1791370074";
import { guessLocation, sunTimes, moonIllumination, moonPosition, moonPhaseName } from "./core/astro.js?v=90736be-1791370074";
import { classifyWeather, weatherUrl, parseWeather } from "./core/weather.js?v=90736be-1791370074";
import { createFacePicker, pickFace } from "./render/face.js?v=90736be-1791370074";
import { SPRITES, drawSprite } from "./render/sprites.js?v=90736be-1791370074";
import { loadProfile, saveProfile, freshProfile, exportCode, importCode, SAVE_KEYS, setSaveMirror, resetProfile } from "./app/store.js?v=90736be-1791370074";
import * as native from "./app/native.js?v=90736be-1791370074";
import * as cloud from "./app/cloud.js?v=90736be-1791370074";
import { planReconcile, isPaid } from "./core/billing.js?v=90736be-1791370074";
import { queueEarn, needsWallet, pendingGems, reconcileOwned } from "./core/wallet.js?v=90736be-1791370074";
import * as wallet from "./app/wallet.js?v=90736be-1791370074";
import { sfx, setSoundEnabled } from "./app/sound.js?v=90736be-1791370074";
import { markSeen, recordPet, renderCollection, letterText, portrait, currentKey, HOW_KO, unlockedSet, REWARDS, nextGoal, adultsSeen, ADULT_KEYS, formOrder, EGG_COLOR_KO } from "./app/collection.js?v=90736be-1791370074";
import { deviceInfo, registerSW, enablePush, ensurePush, uploadSchedule, sendTest, serverStatus, PUSH_SERVER } from "./app/push.js?v=90736be-1791370074";

const clock = { offset: 0, now() { return Date.now() + this.offset; } }; // offset은 개발 도구만 바꾼다

const DOT_WIDTH = 128;
const $ = (id) => document.getElementById(id);
const stage = $("stage"), canvas = $("room"), ctx = canvas.getContext("2d");
let view = { w: DOT_WIDTH, h: 200 };
const QS = new URLSearchParams(location.search);
if (QS.has("dev") && QS.has("reset")) { localStorage.clear(); history.replaceState(null, "", location.pathname + "?dev"); } // 개발용 초기화
await native.restoreSave(SAVE_KEYS); // 앱: WebView 저장소가 지워졌으면 기기 저장소에서 되살림(웹은 아무 일 없음)
setSaveMirror(native.mirrorSave);
let profile = loadProfile();
const cloudBootSeen = profile.lastSeen || 0; // 이 기기를 마지막으로 쓴 시각(켜자마자 바뀌기 전 값, 다른 기기 기록과 비교할 때 씀)
const anim = createAnimator();
const faces = createFacePicker();
let petBox = null; // 마지막으로 그린 펫 위치(쓰다듬기 판정용)
let poopRects = []; // 마지막으로 그린 똥 위치(톡 치우기 판정용)
let windowBox = null; // 창문 위치(누르면 하늘 정보)

// ---------- 실제 날씨 (Open-Meteo, 20분마다) ----------
let weatherNow = classifyWeather(null);
const DEV_WEATHER = { rain: 63, heavyrain: 65, drizzle: 51, snow: 73, heavysnow: 75, thunder: 95, fog: 45, cloudy: 3, sleet: 66 };
function refreshWeatherView() {
  const force = QS.has("dev") && QS.get("weather");
  if (force && DEV_WEATHER[force] !== undefined) weatherNow = classifyWeather({ code: DEV_WEATHER[force], cloud: 100, at: Date.now() });
  else weatherNow = profile.settings.weather === false ? classifyWeather(null) : classifyWeather(profile.weatherRaw);
}
async function updateWeather(force = false) {
  if (profile.settings.weather === false || !navigator.onLine) return refreshWeatherView();
  const last = profile.weatherRaw;
  const loc = profile.settings.location;
  if (!force && last && Date.now() - last.at < 20 * 60 * 1000 && last.lat === loc.lat && last.lon === loc.lon) return refreshWeatherView();
  try {
    const res = await fetch(weatherUrl(loc.lat, loc.lon));
    const raw = parseWeather(await res.json());
    if (raw) { profile.weatherRaw = { ...raw, lat: loc.lat, lon: loc.lon }; persist(); }
  } catch { /* 날씨를 못 받으면 지난 날씨(3시간까지) 또는 맑음 */ }
  refreshWeatherView();
}
let lookCache = { key: "", look: null };
const I = (n) => josa(n, "이", "가");

// ---------- 화면 크기 ----------
// 상점·꾸미기 창이 방 아래를 덮으면, 방은 평소 크기·배율 그대로 두고 펫(머리 장식 포함)~발밑이 창 위에 오도록 위로 올린다.
// (디자인 자문 A안의 '모자라면 창문 쪽부터 위를 잘라도 됨'. 줄이거나 눌러 그리면 폰에서 펫이 너무 작거나 방이 찌그러졌음)
const PET_TOP_ROOM = 70, PET_FOOT_ROOM = 14; // 발 기준선(baseY)에서 위로 펫+모자, 아래로 그림자·러그가 보일 여유(도트)
function sheetCover() {
  const sh = [...document.querySelectorAll(".sheet.shop, .sheet.deco")].find((s) => !s.hidden);
  if (!sh) return 0;
  return Math.max(0, Math.round(stage.getBoundingClientRect().bottom - sh.getBoundingClientRect().top));
}
function fitCanvas() {
  const rect = stage.getBoundingClientRect();
  const scale = Math.max(1, Math.round(rect.width / DOT_WIDTH)); // 정수배라야 도트가 안 뭉개져요
  const w = Math.floor(rect.width / scale), h = Math.floor(rect.height / scale);
  const cover = sheetCover();
  let lift = 0;
  if (cover) {
    const visRows = Math.floor((rect.height - cover) / scale);
    const { baseY } = roomLayout(w, h, {});
    lift = Math.max(0, Math.min(h - visRows, baseY + PET_FOOT_ROOM - visRows)); // 발밑 여유가 창 바로 위에 오게
    if (baseY - PET_TOP_ROOM < lift) lift = Math.max(0, baseY - PET_TOP_ROOM); // 그래도 머리가 잘리면 머리 쪽을 우선
  }
  stage.classList.toggle("covered", cover > 0);
  canvas.style.transform = lift ? `translateY(${-lift * scale}px)` : "";
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
  if (p.ended) return p.ended.type === "star" ? `${I(n)} 하늘의 별이 됐어요` : `${I(n)} 편지를 남기고 떠났어요`;
  if (p.stage === "egg") return "알이 곧 깨어나요";
  if (p.asleep) return p.lightOn ? `${I(n)} 자고 있어요. 불을 꺼 주세요` : `${I(n)} 쿨쿨 자고 있어요`;
  if (p.sick) return `${I(n)} 아파요. 약이 필요해요`;
  if (p.stats.hunger <= 0) return `${I(n)} 배고파서 울고 있어요`;
  if (p.stats.mood <= 0) return `${I(n)} 심심해서 울고 있어요`;
  if (p.stats.hunger <= 20) return `${I(n)} 배고파요`;
  if (p.poops >= 2) return "똥을 톡 눌러 치워 주세요";
  if (p.stats.mood <= 20) return `${I(n)} 놀아 달래요`;
  if (p.napLeft > 0) return `${I(n)} 낮잠 자는 중 (기운 ${Math.round(p.stats.energy)})`;
  if (p.stats.energy < 30) return `${I(n)} 졸려 해요. 불을 끄면 낮잠을 자요`;
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
  renderWallet();
  if (!p) { box.innerHTML = ""; $("petname").textContent = "알모찌"; $("sub").textContent = ""; return; }
  const rows = [["배부름", "hunger"], ["기분", "mood"], ["깨끗함", "clean"], ["기운", "energy"], ["건강", "health"]];
  box.innerHTML = rows.map(([label, k]) => {
    const v = Math.round(p.stats[k]);
    const cls = v <= 20 ? "low" : v <= 50 ? "mid" : "";
    return `<div class="stat ${cls}" title="${label} ${v}">${label}<i><u style="width:${v}%"></u></i><b>${v}</b></div>`;
  }).join("");
  const key = currentKey(p);
  $("sub").textContent = `${key ? FORMS_REF[key]?.name || "" : "알"} · ${Math.floor(p.ageMin / 1440) + 1}일째`;
  $("petname").textContent = p.name;
  // 기운이 낮은 낮에는 "재우기"로 보여서 낮잠을 재울 수 있다는 걸 알게
  const napHint = p.lightOn && !p.asleep && p.napLeft <= 0 && p.stage !== "egg" && p.stats.energy < 50;
  $("btn-light").querySelector("span").textContent = !p.lightOn ? (p.napLeft > 0 ? "깨우기" : "불 켜기") : napHint ? "재우기" : "불 끄기";
  // 약 버튼은 늘 그 자리에(안 아플 땐 흐리게, 아플 땐 강조). 꾸미기는 위쪽 헤더 버튼으로 옮김(사용자 요청, 디자인 자문)
  const ex = $("btn-extra"), sick = !!p.sick;
  ex.classList.toggle("sick", sick); ex.classList.toggle("dim", !sick);
}

// 위쪽 화폐
let walletShown = { star: -1, gem: -1 };
function renderWallet() {
  const e = profile.econ; if (!e) return;
  const g = gems(e);
  if (walletShown.star !== e.star) { $("n-star").textContent = e.star.toLocaleString(); if (walletShown.star >= 0 && e.star > walletShown.star) bump("coin-star"); }
  if (walletShown.gem !== g) { $("n-gem").textContent = g.toLocaleString(); if (walletShown.gem >= 0 && g > walletShown.gem) bump("coin-gem"); }
  walletShown = { star: e.star, gem: g };
  $("coin-gem").classList.toggle("stale", !!profile.wallet?.created && !gemOnline()); // 마지막으로 받은 서버 값(확인 전이면 흐리게)
}
function bump(id) { const b = $(id); b.classList.add("bump"); setTimeout(() => b.classList.remove("bump"), 180); }
// 벌었을 때 화폐 옆에 +n
function gainFx(res) {
  if (!res) return;
  for (const [kind, n] of [["star", res.star], ["gem", res.gem]]) {
    if (!n) continue;
    const b = $(kind === "star" ? "coin-star" : "coin-gem").getBoundingClientRect(), app = $("app").getBoundingClientRect();
    const d = document.createElement("div"); d.className = `gain ${kind}`; d.textContent = `+${n}`;
    d.style.left = `${b.left - app.left + b.width / 2 - 10}px`; d.style.top = `${b.bottom - app.top + 2}px`;
    $("app").append(d); setTimeout(() => d.remove(), 1200);
  }
  renderWallet(); persist();
}
function reward(kind, sub = null) { const r = earn(profile.econ, kind, clock.now(), sub); gainFx({ star: r.star }); return r; } // 보석은 서버 지갑에 적립 요청(earnGem)

// ---------- 하트 보석 서버 지갑(docs/wallet.md) ----------
// 보석 잔액·보석으로 산 꾸미기는 서버가 정한다. 인터넷이 없으면 보석은 못 쓰고, 받을 보석은 대기열에 두었다가 연결되면 보낸다.
const wsave = () => saveProfile(profile);
let gemBusy = false, walletSyncing = false;
// 지갑이 있으면 실제 요청 결과로, 없으면(보석 0) 기기 연결 상태로 판단
const gemOnline = () => navigator.onLine && (!profile.wallet?.created || (wallet.net.ok && Date.now() - wallet.net.at < 30 * 60 * 1000));
async function walletSync() {
  if (walletSyncing || !navigator.onLine) { renderWallet(); return; }
  walletSyncing = true;
  try {
    const wl = profile.wallet;
    if (wl?.key || needsWallet(profile)) await (wl?.created ? wallet.refresh(profile, wsave) : wallet.ensureWallet(profile, wsave));
    if (profile.walletMergeFrom && profile.wallet?.created) { // 다른 기기 기록을 불러올 때 못 끝낸 합치기
      const r = await wallet.mergeInto(profile.wallet.key, profile.walletMergeFrom);
      if (r.ok || [404, 409, 410].includes(r.status)) { delete profile.walletMergeFrom; if (r.data?.w) await wallet.refresh(profile, wsave); wsave(); }
    }
    const got = await wallet.flushEarn(profile, wsave);
    if (got) { gainFx({ gem: got }); }
    await sealWallet();
  } catch (e) { console.warn("지갑 확인 실패", e); } finally { walletSyncing = false; }
  renderWallet(); persist();
  if (!$("start").hidden) renderThemeLocks(); // 알 고르기 화면의 보석 수
  if (!document.querySelector('[data-sheet="shop"]').hidden) renderShopUI();
  if (!document.querySelector('[data-sheet="deco"]').hidden) renderDecoUI();
}
// 이어하기가 켜져 있으면 지갑 열쇠를 이어하기 코드로 잠가 기록에 넣고(walletEnc), 서버 지갑에 이어하기를 연결해 둔다(삭제 페이지에서 함께 지우기)
async function sealWallet() {
  const wl = profile.wallet, c = profile.cloud;
  if (!wl?.key || !wl.created || !c?.key) return;
  const tag = (await wallet.acctOf("tag:" + wl.key)).slice(0, 8); // 어느 지갑을 잠갔는지(열쇠 일부를 드러내지 않게 해시로)
  if (await wallet.sealedFor(profile.walletEnc, c.key) && profile.walletEnc.w === tag) return;
  profile.walletEnc = { ...(await wallet.sealWalletKey(wl.key, c.key)), w: tag };
  await wallet.linkSave(wl.key, c.key);
  persist();
}
// 무료 보석(매일 선물 7일째·비밀 알): 서버 지갑에 적립 요청. 오프라인이면 대기열
function earnGem(kind, id = null) {
  queueEarn(profile, kind, id, wallet.newOp()); wsave();
  walletSync();
}
// 다른 기기 기록(이어하기·저장 코드)을 불러올 때 지갑 정하기: 들어오는 지갑이 있으면 그것을 쓰고, 이 기기 지갑의 산 보석·산 꾸미기는 합친다
async function adoptWallet(p, incomingKey) {
  const mine = profile.wallet;
  if (!incomingKey || incomingKey === mine?.key) { p.wallet = mine; return; }
  p.wallet = { key: incomingKey, queue: mine?.queue || [], created: true, migrated: true };
  p.econ.gemFree = 0; p.econ.gemPaid = 0; // 새로 받아 올 때까지
  if (mine?.created && ((mine.paid || 0) > 0 || (mine.owned || []).length)) {
    const r = await wallet.mergeInto(incomingKey, mine.key).catch(() => ({ ok: false, status: 0 }));
    if (!r.ok && ![404, 409, 410].includes(r.status)) p.walletMergeFrom = mine.key; // 연결되면 다시
  }
}

// ---------- 저장 + 알림 일정 ----------
let syncTimer = 0;
function persist() { if (leaving) return; saveProfile(profile); markCloudDirty(); }
// ---------- 클라우드 이어하기(켜 둔 경우만) ----------
let cloudBusy = false, cloudTimer = 0, cloudLastCheck = 0, leaving = false, cloudEdits = 0, cloudAgain = false;
function markCloudDirty() {
  const c = profile.cloud; if (!c?.key) return;
  c.dirty = true; cloudEdits++;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => cloudSync(), Math.max(2000, (c.lastUp || 0) + cloud.UPLOAD_GAP_MS - Date.now()));
}
async function cloudSync({ urgent = false, keepalive = false } = {}) {
  const c = profile.cloud;
  if (cloudBusy) { if (urgent) cloudAgain = true; return; } // 올리는 중에 급한 요청이 오면 끝난 뒤 한 번 더(전수 조사 B8)
  if (!cloud.uploadDue(c, Date.now(), { urgent })) return;
  cloudBusy = true; cloudAgain = false;
  const v = cloudEdits;
  try {
    const r = await cloud.cloudPut(c.key, cloud.blobOf(profile), c.rev, { keepalive });
    if (r.ok) { c.rev = r.rev; c.dirty = cloudEdits !== v; c.lastUp = Date.now(); c.err = null; } // 올리는 사이 바뀐 게 있으면 표시 유지
    else if (r.conflict) { c.holdUntil = Date.now() + 3600 * 1000; showCloudConflict(); }
    else if (r.wait) { c.holdUntil = Date.now() + r.wait; clearTimeout(cloudTimer); cloudTimer = setTimeout(() => cloudSync({ urgent }), r.wait + 500); }
    saveProfile(profile);
  } catch (e) { c.err = String(e?.message || e); } finally { cloudBusy = false; }
  if (cloudAgain && profile.cloud?.dirty) { cloudAgain = false; setTimeout(() => cloudSync({ urgent: true }), 0); }
}
// 켤 때·다시 열 때: 다른 기기가 더 최근에 저장했으면 가져온다(이 기기에 안 올린 변경이 있으면 고르게)
async function cloudCheck({ atBoot = false } = {}) {
  const c = profile.cloud; if (!c?.key || !navigator.onLine) return;
  if (!atBoot && Date.now() - cloudLastCheck < 5 * 60 * 1000) return;
  cloudLastCheck = Date.now();
  try {
    const remote = await cloud.cloudGet(c.key);
    if (!remote) { c.rev = null; markCloudDirty(); return; } // 서버에서 지워졌거나 오래돼 정리됨 → 이 기기 기록으로 다시 올림
    if (remote.rev === c.rev) return;
    // 서버 기록이 이 기기를 마지막으로 쓴 뒤에 저장됐으면 = 다른 기기에서 더 나중에 키움 → 묻지 않고 불러옴.
    // 이 기기도 그 뒤에 썼는데 아직 못 올렸으면(둘 다 바뀜) 고르게 한다. (시간만 흘러 생긴 변경으로 매번 묻지 않게)
    const seen = atBoot ? cloudBootSeen : (profile.lastSeen || 0);
    if (!c.dirty || remote.updated > seen) await applyCloud(remote, c.key, "다른 기기에서 키운 기록을 불러왔어요");
    else showCloudConflict(remote);
  } catch (e) { console.warn("이어하기 확인 실패", e); }
}
async function applyCloud(remote, key, msg) {
  const p = cloud.profileFromBlob(remote.blob, profile);
  await adoptWallet(p, await wallet.openWalletKey(p.walletEnc, key));
  p.cloud = { key, rev: remote.rev, dirty: false, lastUp: Date.now() };
  p.lastSeen = Date.now();
  // 새로고침 직전 '화면 내려감' 처리가 옛 기록(메모리의 profile)을 다시 저장해 덮어쓰던 문제 → 먼저 바꿔 끼우고 저장을 멈춤
  profile = p; leaving = true;
  saveProfile(p);
  sessionStorage.setItem("almochi:say", msg);
  location.reload();
}
function showCloudConflict(remote = null) {
  if (document.querySelector(".dexcard.cloudpick")) return;
  const c = profile.cloud;
  const card = document.createElement("div"); card.className = "dexcard cloudpick";
  const when = remote?.updated ? new Date(remote.updated).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  card.innerHTML = `<div class="dexcard-in"><button class="x" aria-label="나중에">✕</button><b>다른 기기에 더 최근 기록이 있어요</b>
    <p class="small">${when ? `${when}에 다른 기기에서 저장했어요. ` : ""}어느 쪽으로 이어 할까요? 고르지 않은 쪽 기록은 사라져요.</p>
    <button class="big" id="cp-remote">그 기록 불러오기</button><button class="big ghost" id="cp-local">이 기기 기록으로 덮어쓰기</button></div>`;
  document.body.append(card);
  const close = () => card.remove();
  card.querySelector(".x").addEventListener("click", () => { c.holdUntil = Date.now() + 3600 * 1000; saveProfile(profile); close(); });
  card.querySelector("#cp-remote").addEventListener("click", async () => {
    try { const r = remote || await cloud.cloudGet(c.key); if (r) await applyCloud(r, c.key, "다른 기기의 기록으로 이어 해요"); else close(); } catch (e) { say(e.message, 5000); }
  });
  card.querySelector("#cp-local").addEventListener("click", async () => {
    try { const r = await cloud.cloudPut(c.key, cloud.blobOf(profile), c.rev, { force: true }); if (r.ok) { c.rev = r.rev; c.dirty = false; c.lastUp = Date.now(); c.holdUntil = 0; saveProfile(profile); say("이 기기 기록으로 저장했어요", 4000); } close(); }
    catch (e) { say(e.message, 5000); }
  });
}
function renderCloud() {
  const c = profile.cloud, box = $("cloud-body");
  const last = c?.lastUp ? new Date(c.lastUp).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "아직 없음";
  box.innerHTML = c?.key ? `
    <p class="small">이 코드로 다른 휴대폰·웹에서 이어 키울 수 있어요.</p>
    <div class="savecode" id="cl-code">${cloud.showKey(c.key)}</div>
    <button class="big" id="cl-copy">코드 복사</button>
    <p class="warn small">이 코드만 있으면 누구나 이 기록을 불러올 수 있어요. 남에게 보여 주지 말고 메모나 스크린샷으로 꼭 보관해 주세요. 잃어버리면 서버 기록을 찾을 수 없어요.</p>
    <p class="small">마지막 서버 저장: <b>${last}</b>${c.err ? ` · <span class="dim">실패: ${c.err}</span>` : ""}</p>
    <button class="big ghost" id="cl-now">지금 저장</button>
    <h3 class="sec">새 휴대폰으로 옮기기</h3>
    <p class="small">기기 이전 코드(8글자)를 만들어 새 휴대폰의 메뉴 → 이어하기에 넣으면 돼요. 15분 동안 한 번만 쓸 수 있어요.</p>
    <div id="cl-tcode"></div>
    <button class="big ghost" id="cl-transfer">기기 이전 코드 만들기</button>
    <h3 class="sec">다른 코드로 불러오기</h3>
    <input id="cl-input" placeholder="8글자 또는 32글자 코드" autocomplete="off" autocapitalize="characters"><button class="big ghost" id="cl-load">불러오기</button>
    <button class="big ghost danger" id="cl-off">이어하기 끄고 서버 기록 지우기</button>`
    : `
    <p class="small">펫 기록은 이 휴대폰 안에 저장돼요. 이어하기를 켜면 서버에도 보관해서, 휴대폰을 바꾸거나 앱을 지워도 <b>이어하기 코드</b>로 이어 키울 수 있어요. 로그인은 없어요.</p>
    <button class="big" id="cl-on">이어하기 켜기 (코드 만들기)</button>
    <h3 class="sec">다른 기기에서 키우던 펫 불러오기</h3>
    <p class="small">옛 휴대폰에서 만든 <b>기기 이전 코드(8글자)</b>나 <b>이어하기 코드(32글자)</b>를 넣어 주세요.</p>
    <input id="cl-input" placeholder="XXXX-XXXX" autocomplete="off" autocapitalize="characters"><button class="big ghost" id="cl-load">불러오기</button>
    <p class="fine">서버에는 펫·도감·별사탕·꾸미기 기록만 보관해요. 400일 동안 안 쓰면 지워져요. 하트 보석은 따로 서버 지갑에 있어요. <a href="privacy.html" target="_blank" rel="noopener">개인정보 처리방침</a></p>`;
  $("cl-on")?.addEventListener("click", async () => {
    profile.cloud = { key: cloud.newSaveKey(), rev: null, dirty: true, lastUp: 0 }; saveProfile(profile);
    await sealWallet().catch(() => {}); // 지갑 열쇠를 이어하기 코드로 잠가 함께 올림
    await cloudSync({ urgent: true });
    say(profile.cloud.err ? "코드는 만들었는데 서버 저장은 실패했어요. 인터넷 연결 뒤 다시 저장돼요" : "이어하기를 켰어요. 코드를 꼭 보관해 주세요", 6000);
    renderCloud(); renderQuickSettings();
  });
  $("cl-copy")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(cloud.showKey(c.key)); say("코드를 복사했어요", 2500); } catch { say("복사가 안 돼요. 코드를 길게 눌러 복사해 주세요", 4000); } });
  $("cl-now")?.addEventListener("click", async () => { c.dirty = true; await cloudSync({ urgent: true }); renderCloud(); say(c.err ? "저장하지 못했어요: " + c.err : "서버에 저장했어요", 3000); });
  $("cl-transfer")?.addEventListener("click", async () => {
    try {
      if (c.dirty) { await cloudSync({ urgent: true }); } // 옮기기 전에 최신 기록을 먼저 올림
      const t = await cloud.transferCreate(c.key);
      const until = new Date(t.expires).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
      $("cl-tcode").innerHTML = `<div class="savecode">${t.code.slice(0, 4)}-${t.code.slice(4)}</div><p class="small">${until}까지 한 번만 쓸 수 있어요. 새 휴대폰에 넣은 뒤에는 이 휴대폰에서 키우지 말아 주세요(나중에 연 쪽이 더 최근 기록이 돼요).</p>`;
    } catch (e) { say(e.message || "만들지 못했어요", 5000); }
  });
  $("cl-load")?.addEventListener("click", async () => {
    const raw = $("cl-input").value;
    let key = cloud.readKey(raw);
    try {
      if (!key) {
        const t = cloud.readTransfer(raw);
        if (!t) { say("코드가 올바르지 않아요. 8글자 또는 32글자를 모두 넣어 주세요", 4000); return; }
        key = await cloud.transferRedeem(t);
      }
      const r = await cloud.cloudGet(key);
      if (!r) { say("이 코드로 저장된 기록이 없어요", 4000); return; }
      if (!confirm(`지금 기기의 펫을 이 기록으로 바꿀까요? 지금 펫은 사라져요.${giftGemNote()}`)) return;
      await applyCloud(r, key, "이어하기 코드로 기록을 불러왔어요");
    } catch (e) { say(e.message || "불러오지 못했어요", 5000); }
  });
  $("cl-off")?.addEventListener("click", async () => {
    if (!confirm("이어하기를 끄고 서버에 있는 기록을 지울까요? 이 휴대폰의 펫은 그대로 남아요.")) return;
    try { await cloud.cloudDelete(c.key); profile.cloud = null; saveProfile(profile); say("서버 기록을 지웠어요", 4000); renderCloud(); renderQuickSettings(); }
    catch (e) { say(e.message || "지우지 못했어요", 5000); }
  });
}
function scheduleSync(delay = 2500) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(), delay);
}
async function syncNow({ keepalive = false } = {}) {
  if (!profile.pet || !profile.push.subscribed) return;
  try {
    const { notes } = predictNotifications(profile.pet, clock.now(), profile.settings);
    if (IS_APP) await native.scheduleLocal(notes, clock.now());
    else await uploadSchedule(profile.deviceId, notes, { keepalive });
    profile.push.lastSync = Date.now(); profile.push.nextAt = notes[0]?.at || null; persist();
  } catch (e) { console.warn("알림 일정 올리기 실패", e); }
}

// 펫이 없어졌을 때 예약된 알림 지우기: 앱은 기기 안 예약 취소, 웹은 서버 일정 비우기(앱은 서버로 아무것도 안 보냄, B6·B7)
function clearSchedule() {
  if (IS_APP) native.cancelLocal().catch(() => {});
  else if (profile.push?.subscribed) uploadSchedule(profile.deviceId, []).catch(() => {});
}
// ---------- 돌봄 행동 ----------
const REFUSE = {
  egg: "아직 알이에요", asleep: "자고 있어요. 깨면 해 주세요", ended: "이제 여기 없어요", full: "배불러서 안 먹는대요",
  tired: "너무 지쳐서 못 논대요. 불을 끄면 낮잠을 자요", "not-sick": "안 아픈데 약을 줘서 싫어해요",
};
// 행동 → 애니메이션: anims(결과) 가 재생할 애니메이션 이름과 데이터를 돌려준다
// 필요한 돌봄을 했을 때만 별사탕(배고플 때 밥, 더러울 때 씻기, 아플 때 약, 잠들었는데 켜진 불 끄기)
function careReward(name, before, p, r) {
  if (name === "meal" && before.hunger < 60) reward("care", "meal");
  else if (name === "wash" && before.clean < 60) reward("care", "wash");
  else if (name === "medicine" && before.sick) reward("care", "medicine");
  else if (name === "lightOff" && before.asleep && before.lightOn) reward("care", "lightOff");
}

// 밥·씻기 같은 돌봄 동작이 끝나기 전에는 다른 돌봄(재우기 포함)을 받지 않는다.
// (사용자 지적: 씻는 도중 재우기를 누르면 욕조 속에서 잠들었음. 반대로 자는 중 씻기는 먼저 깨움 → 둘 다 '하던 걸 끝내고' 규칙으로 맞춤)
const BUSY_KO = { meal: "밥 먹는", snack: "간식 먹는", play: "노는", wash: "씻는", medicine: "약 먹는" };
let actBusy = { until: 0, name: "" };
// 다른 돌봄을 지금 받을 수 없으면 이유를 말하고 true(동작 중·산책 중). 놀이·산책·밥 창·약에도 같은 규칙(전수 조사 A2·B3)
function refuseIfBusy() {
  if (walking()) { say("산책 중이에요. 다녀와서 해 주세요", 2500); sfx("refuse"); return true; }
  if (performance.now() < actBusy.until) { say(`${BUSY_KO[actBusy.name] || "하던"} 중이에요. 끝나면 해 주세요`, 2500); sfx("refuse"); return true; }
  return false;
}
function act(fn, okText, anims) {
  const p = profile.pet; if (!p) return;
  if (refuseIfBusy()) return; // 산책 중·다른 동작 중엔 안내하고 안 함
  const before = { poops: p.poops, lightOn: p.lightOn, sick: p.sick, hunger: p.stats.hunger, clean: p.stats.clean, asleep: p.asleep };
  const r = fn(p, clock.now());
  handleEvents(r.events);
  const t = performance.now();
  if (r.ok) {
    const [name, data] = anims(r, before);
    if (BUSY_KO[name]) actBusy = { until: performance.now() + (r.woke ? 1300 : 0) + (ANIM_DUR[name] || 1000), name };
    if (r.woke) { // 낮잠 중이었으면 먼저 깨고(기지개) 그다음 행동
      say(name === "untuck" ? okText(p, r) : `${josa(p.name, "을", "를")} 깨웠어요. ${okText(p, r)}`); // 깨우기 자체면 '깨웠어요'를 겹쳐 쓰지 않음
      // 깨우기(불 켜기)는 깨는 것 자체가 행동이라 기지개(untuck)를 두 번 틀지 않는다(쿠션이 두 번 생겼다 사라지던 원인)
      if (name && name !== "untuck") setTimeout(() => { playAnim(anim, name, performance.now(), data); sfx(SFX_OF[name] || "tap"); }, 1300);
    } else {
      say(okText(p, r));
      if (name) { playAnim(anim, name, t, data); sfx(SFX_OF[name] || "tap"); }
    }
    setTimeout(() => profile.pet && pickFace(faces, profile.pet, performance.now(), { force: true }), 1800);
    careReward(name, before, p, r);
  } else {
    say(REFUSE[r.reason] || "지금은 안 된대요");
    sfx(r.reason === "not-sick" ? "bitter" : "refuse");
    if (r.reason === "asleep") playAnim(anim, "sleepyRefuse", t);
    else if (r.reason === "not-sick") playAnim(anim, "medicine", t, { bitter: true });
    else if (r.reason !== "egg") playAnim(anim, "refuse", t);
  }
  renderStats(); persist(); scheduleSync();
}
const SFX_OF = { meal: "eat", snack: "snack", play: "happy", wash: "wash", lightOn: "light", lightOff: "light", medicine: "medicine" };
const S = () => profile.settings;
const ACTIONS = {
  food: () => { const p = profile.pet; if (!p || refuseIfBusy()) return; if (p.stage === "egg") { say(REFUSE.egg); sfx("refuse"); return; } openSheet("food"); },
  meal: () => { closeSheet(); act((p, t) => feed(p, "meal", t, S()), (p) => `${I(p.name)} 냠냠 먹었어요`, () => ["meal"]); },
  snack: () => { closeSheet(); act((p, t) => feed(p, "snack", t, S()), (p) => `${I(p.name)} 간식을 좋아해요`, () => ["snack"]); },
  play: () => { const p = profile.pet; if (!p || refuseIfBusy()) return; if (p.stage === "egg") { say(REFUSE.egg); sfx("refuse"); return; } openSheet("play"); },
  playHome: () => { closeSheet(); startMinigame(); },
  walk: () => { closeSheet(); startWalk(); },
  deco: () => openDeco(),
  wash: () => act((p, t) => wash(p, t, S()), (p) => (p.poops ? "뽀득뽀득 깨끗해졌어요. 바닥의 똥은 톡 눌러 치워요" : "뽀득뽀득 깨끗해졌어요"), () => ["wash"]),
  light: () => act((p, t) => toggleLight(p, t, S()), (p, r) => (r.napped ? `불을 껐어요. ${I(p.name)} 낮잠을 자요 (1시간 뒤 깨요)` : r.woke ? `불을 켰어요. ${I(p.name)} 낮잠에서 깼어요` : r.notSleepy ? `불을 껐어요. ${I(p.name)} 아직 안 졸린대요` : p.lightOn ? "불을 켰어요" : "불을 껐어요"), (r) => (r.napped ? ["tuckIn", { night: false }] : r.woke ? ["untuck", { night: false }] : [r.lightOn ? "lightOn" : "lightOff"])),
  medicine: () => (profile.pet && !profile.pet.sick && !profile.pet.ended && profile.pet.stage !== "egg" && !profile.pet.asleep && !walking() && performance.now() >= actBusy.until ? (say("지금은 안 아파요", 2000), sfx("tap")) : act((p, t) => giveMedicine(p, t, S()), (p) => (p.sick ? "약을 먹었어요. 한 번 더 필요해요" : "다 나았어요"), () => ["medicine"])),
};

const PREV_STAGE = { baby: "egg", child: "baby", teen: "child", adult: "teen" };
const FORMS_NAME = () => { const k = profile.pet && currentKey(profile.pet); return k ? (FORMS_REF[k]?.name || "") : ""; };
function handleEvents(events) {
  const t = performance.now();
  for (const e of events) {
    const th = profile.pet.theme;
    if (e.type === "hatch") { say(`알이 깨어났어요! ${josa(profile.pet.name, "이에요", "예요")}`, 6000); playAnim(anim, "hatch", t, { eggKey: `${th}.egg` }); sfx("hatch"); see(profile.pet); }
    if (e.type === "evolve") {
      const prevBranch = e.stage === "adult" ? (e.branch === "A" || e.branch === "B" ? "good" : "normal") : null;
      say(`${I(profile.pet.name)} ${I(STAGE_KO[e.stage])} 됐어요!`, 6000);
      playAnim(anim, "evolve", t, { fromKey: formKey(th, PREV_STAGE[e.stage], prevBranch), toKey: formKey(th, e.stage, e.branch) });
      setTimeout(() => sfx("evolve"), 2100);
      setTimeout(() => reward("evolve"), 3000);
      see(profile.pet);
      if (e.branch === "S") setTimeout(() => say(`숨은 친구 ${FORMS_NAME()}! 많이 쓰다듬어 준 덕분이에요`, 8000), 3200);
      setTimeout(() => pickFace(faces, profile.pet, performance.now(), { force: true }), 3200);
    }
    if (e.type === "poop") { if (!anim.cur) playAnim(anim, "poop", t); if (!profile.pet.asleep) { say("똥을 쌌어요. 톡 눌러 치워 주세요", 5000); sfx("poop"); } }
    if (e.type === "sleep" || e.type === "nap") playAnim(anim, "tuckIn", t, { night: e.type === "sleep" });
    if ((e.type === "wake" || e.type === "nap-end") && !profile.pet.ended) playAnim(anim, "untuck", t, { night: e.type === "wake" });
    if (e.type === "nap-end" && !e.woke && !profile.pet.asleep) { say(`${I(profile.pet.name)} 낮잠에서 깼어요. 기운이 났대요`, 5000); sfx("greet"); }
    if (e.type === "nap" && !e.manual) say(`${I(profile.pet.name)} 지쳐서 낮잠을 자요`, 5000);
    if (e.type === "farewellSoon") say(e.how === "classic" ? `${I(profile.pet.name)} 많이 늙었어요. 곁에 있어 주세요` : `${I(profile.pet.name)} 내일 여행을 떠난대요. 많이 놀아 주세요`, 9000);
    if (e.type === "ended") startFarewell();
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

const hm = (ms) => (ms ? new Date(ms).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "-");
function skyText() {
  const loc = profile.settings.location, now = clock.now();
  const st = sunTimes(now, loc.lat, loc.lon), ill = moonIllumination(now), mp = moonPosition(now, loc.lat, loc.lon);
  const sun = st.sunrise ? `일출 ${hm(st.sunrise)} · 일몰 ${hm(st.sunset)}` : "오늘은 해가 뜨거나 지지 않아요";
  const wx = weatherNow.label ? ` · 날씨: ${weatherNow.label}${typeof weatherNow.temp === "number" ? ` ${Math.round(weatherNow.temp)}°C` : ""}` : "";
  return `${loc.label}${wx} · ${sun} · 달: ${moonPhaseName(ill.phase)} ${Math.round(ill.fraction * 100)}%${mp.altitude > 0 ? "" : " (실제로는 지평선 아래)"}`;
}

// ---------- 숨은 재미(이스터 에그) ----------
const streaks = { pet: createStreak(8, 3000), win: createStreak(5, 4000), egg: createStreak(8, 3000), dex: createStreak(5, 3000) };
let memoBox = null, lastWish = null;
function discover(id) {
  if (!findEgg(profile, id, clock.now())) return;
  setTimeout(() => { const r = reward("eggFound"); if (r.gem) earnGem("egg", id); }, 1900);
  const e = EGGS.find((x) => x.id === id);
  setTimeout(() => { say(`비밀 발견! '${e.name}' (≡ → 도감에서 모아 봐요)`, 6000); sfx("win"); }, 1800);
  persist();
}
function showNote(title, text) {
  const card = document.createElement("div"); card.className = "dexcard";
  const inner = document.createElement("div"); inner.className = "dexcard-in";
  const b = document.createElement("b"); b.textContent = title;
  const p = document.createElement("p"); p.className = "letter"; p.textContent = text;
  const close = document.createElement("button"); close.className = "x"; close.textContent = "✕"; close.setAttribute("aria-label", "닫기");
  close.addEventListener("click", () => card.remove());
  card.addEventListener("click", (e) => { if (e.target === card) card.remove(); });
  inner.append(close, b, p); card.append(inner); document.body.append(card);
}

function onTap(ev) {
  const p = profile.pet; if (!p) return;
  const r = canvas.getBoundingClientRect();
  const x = ((ev.clientX - r.left) / r.width) * canvas.width, y = ((ev.clientY - r.top) / r.height) * canvas.height;
  if (walking()) return; // 산책 중엔 화면 터치 없음
  if (mg) { if (mg.tap && layout) { const res = mg.tap(x, y, performance.now(), layout); if (res) mgEffect(res); } return; } // 놀이 중엔 화면 터치는 놀이에만
  // 똥을 먼저 본다(누르기 쉽게 여유 6px)
  const hit = poopRects.find((pr) => x >= pr.x - 6 && x <= pr.x + pr.w + 6 && y >= pr.y - 6 && y <= pr.y + pr.h + 6);
  if (windowBox && x >= windowBox.x - 3 && x <= windowBox.x + windowBox.w + 3 && y >= windowBox.y - 3 && y <= windowBox.y + windowBox.h + 3) {
    if (streaks.win.tap(performance.now())) { // 비밀: 창문 5번 → 별똥별
      addFx(anim, "shootingStar", 0, 0, performance.now(), 1400, { rect: { ...windowBox } });
      say("반짝! 별똥별이 지나갔어요. 소원을 빌었어요", 6000); sfx("win"); discover("star");
      return;
    }
    say(skyText(), 7000); sfx("tap"); return;
  }
  if (memoBox && x >= memoBox.x - 2 && x <= memoBox.x + memoBox.w + 2 && y >= memoBox.y - 4 && y <= memoBox.y + memoBox.h + 2) { // 비밀: 추억 액자
    const last = profile.collection[profile.collection.length - 1];
    if (last) {
      if (p.stage !== "egg" && !p.asleep && !p.ended && !anim.cur) playAnim(anim, "lookFrame", performance.now(), { name: last.name });
      say(`추억 액자: ${last.name} (${last.form})`, 4000); sfx("tap"); discover("frame");
      return;
    }
  }
  if (hit) {
    const res = cleanPoop(p, clock.now(), S());
    if (res.ok) {
      const slots = syncPoopSlots();
      const i = slots.indexOf(hit.slot); if (i >= 0) slots.splice(i, 1);
      slots.length = p.poops; // 혹시 어긋나면 맞춤
      addFx(anim, "poof", hit.x + hit.w / 2, hit.y + hit.h / 2, performance.now()); sfx("clean"); reward("care", "poop");
      if (!p.asleep && !anim.cur) playAnim(anim, "tidy", performance.now());
      say(p.poops ? `똥을 치웠어요. ${p.poops}개 남았어요` : "똥을 다 치웠어요", 2500);
      renderStats(); persist(); scheduleSync();
    }
    return;
  }
  if (!petBox) return;
  const m = 8;
  if (x < petBox.x - m || x > petBox.x + petBox.w + m || y < petBox.y - m || y > petBox.y + petBox.h + m) return;
  if (p.ended) return;
  if (p.stage === "egg") {
    if (streaks.egg.tap(performance.now())) { playAnim(anim, "eggPeek", performance.now()); sfx("pet"); say("알 속에서 누가 인사했어요!", 4000); discover("eggPeek"); return; } // 비밀: 알의 인사
    playAnim(anim, "refuse", performance.now()); sfx("tap"); say("알이 꿈틀했어요. 곧 깨어나요", 2500); return;
  }
  if (p.asleep) { playAnim(anim, "sleepyRefuse", performance.now()); say(`${I(p.name)} 자고 있어요. 쉿!`); return; }
  if (p.ended || mg) return;
  patPet(p, clock.now(), S());
  if (streaks.pet.tap(performance.now())) { // 비밀: 아주 빠르게 쓰다듬으면 간지럼
    playAnim(anim, "tickle", performance.now()); sfx("happy"); say(`${I(p.name)} 꺄르르 웃어요!`, 3000); discover("tickle");
  } else if (!anim.cur || anim.cur.type === "pet") { playAnim(anim, "pet", performance.now()); sfx("pet"); say(`${josa(p.name, "을", "를")} 쓰다듬었어요`, 2500); }
  persist();
}

// ---------- 낮잠 중 행동: 먼저 깨우고 이어서 ----------
function napWakeFirst(p, then) {
  if (p.asleep || !(p.napLeft > 0)) return false;
  advance(p, clock.now(), S());
  const ev = [];
  if (!wakeFromNap(p, clock.now(), ev)) return false;
  handleEvents(ev); // 기지개(untuck)
  say(`${josa(p.name, "을", "를")} 깨웠어요`, 2000);
  renderStats(); persist(); scheduleSync();
  setTimeout(then, 1300);
  return true;
}

// ---------- 산책 ----------
const walking = () => !!(anim.cur && anim.cur.type === "walk" && performance.now() - anim.cur.start < anim.cur.dur); // 탭이 숨겨져 그리기가 멈춰도 시간으로 판단
const WALK_KINDS = ["butterfly", "flower", "puddle", "friend"];
const WALK_KO = { butterfly: "나비를 만났어요", flower: "꽃 냄새를 맡았어요", puddle: "웅덩이에서 첨벙했어요", friend: "친구를 만났어요" };
function startWalk() {
  const p = profile.pet; if (!p || refuseIfBusy()) return;
  const reason = p.ended ? "ended" : p.stage === "egg" ? "egg" : p.asleep ? "asleep" : p.stats.energy < 15 ? "tired" : null;
  if (reason) { advance(p, clock.now(), S()); say(REFUSE[reason]); sfx("refuse"); playAnim(anim, reason === "asleep" ? "sleepyRefuse" : "refuse", performance.now()); return; }
  if (napWakeFirst(p, startWalk)) return;
  if (mg) endMinigame(true);
  const wet = !!(weatherNow.kind && ["rain", "drizzle", "thunder", "snow", "sleet"].includes(weatherNow.kind));
  const pool = [...WALK_KINDS].sort(() => Math.random() - 0.5);
  const kinds = wet ? ["puddle", pool.find((k) => k !== "puddle")] : pool.slice(0, 2);
  if (wet && Math.random() < 0.5) kinds.reverse();
  const friends = Object.keys(FORMS_REF).filter((k) => /\.(teen|adult)\./.test(k) && !k.endsWith(".S") && k !== currentKey(p));
  const events = kinds.map((kind) => ({ kind, ...(kind === "friend" ? { friendKey: friends[Math.floor(Math.random() * friends.length)], spot: ["p", "g", "b", "y", "v"][Math.floor(Math.random() * 5)] } : {}) }));
  const m = new Date(clock.now()).getMonth() + 1;
  const season = m >= 3 && m <= 5 ? "spring" : m >= 9 && m <= 11 ? "autumn" : null;
  closeSheet();
  playAnim(anim, "walk", performance.now(), { events, season });
  say(`${I(p.name)} 산책 가요!`, 3000); sfx("happy");
  setTimeout(() => {
    if (!profile.pet || profile.pet !== p) return;
    const friendName = events.find((e) => e.kind === "friend")?.friendKey;
    const what = events.map((e) => (e.kind === "friend" && friendName ? `${FORMS_REF[friendName].name} 친구를 만났어요` : WALK_KO[e.kind])).join(", ");
    act((pp, t) => walk(pp, t, S(), { wet }), (pp) => `산책 다녀왔어요! ${what}${wet ? " (비에 젖었어요)" : ""}`, () => ["mgHop", {}]);
    reward("walk");
  }, ANIM_DUR.walk + 50);
}

// ---------- 놀이(미니게임) 4종, 매번 랜덤 ----------
// 진행 로직은 app/games.js. 여기서는 버튼·문구·캔버스 터치·펫 자세만 이어 붙인다.
let mg = null; // 지금 하는 놀이(games.js 객체)
let lastGame = null;
let layout = null; // 마지막으로 그린 방 배치(놀이 물체 좌표용)
let mgUiKey = "";
function startMinigame() {
  const p = profile.pet; if (!p || refuseIfBusy()) return;
  // 놀 수 없는 상태면 놀기와 같은 거절 반응
  const reason = p.ended ? "ended" : p.stage === "egg" ? "egg" : p.asleep ? "asleep" : p.stats.energy < 10 ? "tired" : null;
  if (reason) { advance(p, clock.now(), S()); say(REFUSE[reason]); sfx("refuse"); playAnim(anim, reason === "asleep" ? "sleepyRefuse" : "refuse", performance.now()); return; }
  if (napWakeFirst(p, startMinigame)) return; // 낮잠 중이면 먼저 깨우고 다시 시작
  const kind = window.__pp?.forceGame || pickGame(lastGame);
  lastGame = kind;
  mg = createGame(kind, performance.now());
  anim.minigame = kind === "side";
  anim.cur = null;
  const row = $("mg-row");
  row.innerHTML = "";
  row.style.gridTemplateColumns = `repeat(${Math.max(1, mg.buttons.length)}, 1fr)`;
  row.hidden = mg.buttons.length === 0;
  mg.buttons.forEach((label, i) => { const b = document.createElement("button"); b.textContent = label; b.addEventListener("click", () => mgPress(i)); row.append(b); });
  $("mg-title").textContent = GAME_NAMES[kind];
  $("mg").hidden = false; $("mg").dataset.kind = kind;
  mgUiKey = "";
  sfx("tap");
}
function mgPress(i) {
  if (!mg || !mg.press) return;
  const r = mg.press(i, performance.now(), layout);
  if (r) mgEffect(r);
}
function mgEffect(r) {
  if (r.sfx) sfx(r.sfx);
  if (r.anim) playAnim(anim, r.anim[0], performance.now(), r.anim[1]);
}
// 매 프레임: 펫 자세·물체를 덧입히고 문구 갱신, 끝났으면 결과 처리
function mgFrame(fr, t) {
  if (!mg || !layout) return;
  const L = layout;
  fr.gameObjs = mg.objects(t, L);
  const pv = mg.pet(t, L) || {};
  const pose = fr.pose;
  if (pv.hidden) fr.hidePet = true;
  if (pv.dx != null) { anim.wander.x = pv.dx; anim.wander.target = pv.dx; pose.dx = pv.dx; }
  if (pv.chaseX != null) { anim.wander.target = pv.chaseX; anim.wander.nextAt = t + 3000; }
  if (pv.center) { anim.wander.target = 0; anim.wander.nextAt = t + 3000; }
  if (pv.dy) pose.dy += pv.dy;
  if (pv.facing) pose.facing = pv.facing;
  if (pv.eyes && !anim.cur) pose.eyes = pv.eyes;
  if (pv.mouth && !anim.cur) pose.mouth = pv.mouth;
  if (pv.squish) { pose.sy *= 0.85; pose.sx *= 1.1; }
  if (mg.bonkNew) { mg.bonkNew = false; sfx("wrong"); }
  const st = mg.status(t, L);
  const key = `${st.text}|${st.dots.join(",")}|${st.enabled}`;
  if (key !== mgUiKey) {
    mgUiKey = key;
    $("mg-text").textContent = st.text;
    $("mg-dots").innerHTML = st.dots.map((d) => `<i class="${d}"></i>`).join("");
    for (const b of $("mg-row").children) b.disabled = !st.enabled;
  }
  if (st.done) endMinigame(false, st);
}
function endMinigame(cancel = false, st = null) {
  const g = mg; mg = null; anim.minigame = false; $("mg").hidden = true;
  if (cancel || !g || !st) { say("놀이를 그만뒀어요"); return; }
  const win = st.win;
  const v = ["ball", "spin", "dance"][Math.floor(Math.random() * 3)]; // 끝 동작도 랜덤
  act((p, t) => play(p, t, S(), { win }), (p) => (win ? `${st.score}! ${josa(p.name, "이", "가")} 아주 신났어요` : `${st.score}. 그래도 ${I(p.name)} 즐거워해요`), () => ["play", { win, v }]);
  reward(win ? "playWin" : "playLose");
  if (win) sfx("win");
}

// ---------- 도감: 새로 만남 + 보상 열림 알림 ----------
function see(pet) {
  const before = unlockedSet(profile);
  const isNew = markSeen(profile, pet, clock.now());
  if (!isNew) return false;
  setTimeout(() => reward("dexNew"), 4200);
  const opened = REWARDS.filter((r) => unlockedSet(profile).has(r.id) && !before.has(r.id));
  syncRewardItems();
  if (opened.length) setTimeout(() => { say(`도감 보상이 열렸어요: ${opened.map((r) => r.label).join(", ")}! (≡ → 도감)`, 9000); sfx("win"); }, 6500);
  persist();
  return true;
}

// 도감 보상 중 상품으로 주는 것(별 러그)
function syncRewardItems() {
  if (unlockedSet(profile).has("starRug") && grantItem(profile.econ, "rug_star", clock.now())) persist();
}

// ---------- 떠남 → 편지 → 도감 → 새 알 ----------
let farewellShown = false;
function startFarewell() {
  const p = profile.pet; if (!p || !p.ended || farewellShown) return;
  farewellShown = true;
  closeSheet(); if (mg) endMinigame(true);
  see(p); persist();
  clearSchedule();
  playAnim(anim, "farewell", performance.now(), { how: p.ended.type });
  sfx("farewell");
  say(statusLine(), 0);
  setTimeout(showLetter, 3900);
}
function showLetter() {
  const p = profile.pet; if (!p) return;
  $("ending-title").textContent = p.ended.type === "star" ? `${I(p.name)} 별이 됐어요` : p.ended.type === "retired" ? `${josa(p.name, "과", "와")} 작별해요` : `${p.name}의 편지`;
  $("ending-letter").textContent = letterText(p);
  $("ending-meta").textContent = `${(p.ageMin / 1440).toFixed(1)}살 · 돌봄 실수 ${p.mistakes.total} · ${HOW_KO[p.ended.type] || ""}`;
  portrait($("ending-portrait"), currentKey(p) || `${p.theme}.egg`, lookCache.look || lookOf(p));
  // 다음 알로 이어지게: 처음 끝까지 함께한 모습인지, 다음 보상까지 얼마나 남았는지
  const key = currentKey(p), first = key && !profile.collection.some((r) => r.key === key);
  const goal = nextGoal(profile), left = ADULT_KEYS.length - adultsSeen(profile).length;
  $("ending-news").textContent = [
    first && key.includes(".adult.") ? "도감에 처음 남는 친구예요!" : "",
    goal ? `다음 보상 '${goal.reward.label}'까지 어른 ${goal.left}종` : "보상을 모두 열었어요",
    left ? `아직 못 만난 어른 친구 ${left}종` : "어른 친구를 모두 만났어요!",
  ].filter(Boolean).join(" · ");
  $("ending").hidden = false;
}
function finishEnding() {
  const p = profile.pet;
  if (p) { recordPet(profile, p); reward("farewell"); }
  profile.pet = null; profile.ui.poopSlots = [];
  farewellShown = false;
  persist();
  $("ending").hidden = true;
  showStart();
  renderStats();
}

// "계속 살기"에서 직접 마무리
function retireNow() {
  const p = profile.pet; if (!p) return;
  if (!confirm(`${josa(p.name, "과", "와")} 작별하고 새 알을 받을까요? ${I(p.name)} 도감에 남아요.`)) return;
  retirePet(p, clock.now(), S());
  closeSheet();
  startFarewell();
}

// ---------- 도감 ----------
function renderDex() {
  renderCollection($("dex-body"), profile, { pet: profile.pet, settings: profile.settings });
  const p = profile.pet;
  const box = $("dex-retire");
  box.innerHTML = "";
  if (p && !p.ended && p.stage === "adult" && profile.settings.endMode === "forever") {
    const b = document.createElement("button"); b.className = "big ghost"; b.textContent = `${josa(p.name, "과", "와")} 작별하고 새 알 받기`;
    b.addEventListener("click", retireNow); box.append(b);
  }
}

// ---------- 저장 내보내기/불러오기 ----------
function renderSave() {
  $("save-code").value = "";
  $("save-msg").textContent = "";
}
async function doExport() {
  persist();
  const code = exportCode(profile);
  $("save-code").value = code;
  const warn = profile.wallet?.key ? " 이 코드에는 하트 보석 지갑도 들어 있어요. 남에게 주지 마세요." : "";
  try { await navigator.clipboard.writeText(code); $("save-msg").textContent = "코드를 복사했어요. 다른 기기(또는 홈 화면 앱)에서 '불러오기'에 붙여 넣으세요." + warn; }
  catch { $("save-code").select(); $("save-msg").textContent = "아래 코드를 길게 눌러 전부 복사해 주세요." + warn; }
}
async function doImport() {
  try {
    const p = importCode($("save-code").value, profile);
    const inc = p.walletIncoming; delete p.walletIncoming;
    if (!confirm(`지금 기기의 펫을 이 저장으로 바꿀까요? 지금 펫은 사라져요.${inc && inc !== profile.wallet?.key ? giftGemNote() : ""}`)) return;
    await adoptWallet(p, inc);
    profile = p; persist();
    location.reload();
  } catch (e) { $("save-msg").textContent = e.message; }
}
// 다른 지갑으로 바뀔 때: 받은 보석은 옮겨지지 않음을 미리 알림(산 보석·산 꾸미기는 옮겨짐)
function giftGemNote() {
  const f = profile.wallet?.created ? Math.max(0, profile.wallet.free || 0) : 0;
  return f > 0 ? `\n\n이 기기의 받은 하트 보석 ${f}개는 옮겨지지 않아요(산 보석과 산 꾸미기는 옮겨져요).` : "";
}

// ---------- 시작 화면 ----------
const draft = { theme: null, speed: "normal", eggColor: null };
// 알 색 고르기(도감 보상). 열려 있으면 테마 다음에 고른다
function renderEggStep() {
  const box = $("egg-colors"); box.innerHTML = "";
  const open = unlockedSet(profile);
  const colors = [...SPOT_COLORS, ...(open.has("goldEgg") ? ["Y"] : []), null];
  for (const c of colors) {
    const b = document.createElement("button"); b.className = "choice egg-choice";
    const cv = document.createElement("canvas"); cv.width = 56; cv.height = 46;
    const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
    drawSprite(ctx, eggSpriteFor(SPRITES, draft.theme, c ? lookOf({ eggColor: c }) : null), 12, 4, 2); // 그 색 무늬 알(무작위는 기본 알)
    b.append(cv, Object.assign(document.createElement("span"), { textContent: c ? EGG_COLOR_KO[c] : "무작위" }));
    b.addEventListener("click", () => { draft.eggColor = c; stepTo("speed"); });
    box.append(b);
  }
}
function showStart() {
  $("start").hidden = false;
  renderThemeLocks();
  stepTo("theme");
}
// 알 고르기: 잠긴 알은 실루엣처럼 흐리게 + 가격을 미리 보여 줌(눌러서 바로 열 수 있게)
function renderThemeLocks() {
  for (const btn of document.querySelectorAll("[data-theme]")) {
    const t = btn.dataset.theme, open = themeOpen(profile.econ, t), line = btn.querySelector(".lockline");
    btn.classList.toggle("locked", !open);
    if (line) { line.hidden = open; if (!open) line.textContent = `하트 보석 ${UNLOCK[THEME_UNLOCK[t]].price.gem}개로 열 수 있어요 (지금 ${gems(profile.econ)}개)`; }
  }
}
// 무지개 알 열기(하트 보석, 서버 지갑으로. 한 번 열면 계속). 돌려줌: 열렸는지
async function openTheme(theme) {
  const u = UNLOCK[THEME_UNLOCK[theme]]; if (!u) return true;
  const price = u.price.gem;
  if (gemBusy) return false;
  if (!navigator.onLine) { sfx("refuse"); say("하트 보석은 인터넷에 연결됐을 때만 쓸 수 있어요", 5000); return false; }
  if (gems(profile.econ) < price) { sfx("refuse"); say(`하트 보석이 ${price - gems(profile.econ)}개 더 필요해요. 매일 선물 7일째와 비밀 찾기로 받거나 상점에서 살 수 있어요`, 6000); return false; }
  if (!confirm(`하트 보석 ${price}개로 무지개 알을 열까요? 한 번 열면 다음 알부터 언제든 고를 수 있어요.`)) return false;
  gemBusy = true;
  try {
    const r = await wallet.spendGem(profile, wsave, u.id, price);
    if (!r.ok && r.data?.reason !== "owned") {
      sfx("refuse");
      say(r.status === 0 ? "인터넷에 연결되지 않았거나 서버가 늦어요. 다시 누르면 이어서 확인해요(두 번 빠지지 않아요)" : r.status === 402 ? "하트 보석이 모자라요" : r.data?.error || "지금은 열 수 없어요", 5000);
      return false;
    }
    persist(); renderWallet(); sfx("win"); say("무지개 알이 열렸어요!", 4000);
    return true;
  } finally {
    gemBusy = false; renderThemeLocks();
    if (!document.querySelector('[data-sheet="shop"]').hidden) renderShopUI();
  }
}
function stepTo(step) {
  for (const el of document.querySelectorAll("#start .step")) el.hidden = el.dataset.step !== step;
  if (step === "name") setTimeout(() => $("name-input").focus(), 50);
}
function startGame() {
  const name = $("name-input").value.trim().slice(0, 6) || (draft.theme === "fantasy" ? "말랑이" : "토리");
  const now = clock.now();
  profile.pet = createPet({ now, seed: (Math.random() * 2 ** 32) >>> 0, theme: draft.theme, speed: draft.speed, name });
  if (draft.eggColor) profile.pet.eggColor = draft.eggColor; // 도감 보상: 고른 알 색
  profile.settings.endMode = "journey"; profile.settings.busy.enabled = false; // 새로 키우는 펫부터 간단 설정(끝 방식·바쁜 시간 걷어냄)
  profile.ui.poopSlots = [];
  persist(); sfx("hatch");
  $("start").hidden = true;
  say(`${name}의 알이에요. 곧 깨어나요`, 6000);
  renderStats(); scheduleSync(500);
  if (!profile.seenGuide) setTimeout(() => openSheet("notify"), 1200);
}

// ---------- 메뉴(설정·알림) ----------
function openSheet(name) {
  if (name !== "shop") previewDeco = null;
  for (const el of document.querySelectorAll(".sheet")) el.hidden = el.dataset.sheet !== name;
  $("backdrop").hidden = name === "shop" || name === "deco"; // 상점·꾸미기는 방이 보이게
  if (name === "notify") renderNotify();
  if (name === "dex") renderDex();
  if (name === "save") renderSave();
  if (name === "shop") renderShopUI();
  if (name === "deco") renderDecoUI();
  if (name === "menu") renderQuickSettings();
  if (name === "help") renderHelp();
  if (name === "cloud") renderCloud();
  if (name === "shop" || name === "deco") fitCanvas(); // 창이 덮는 만큼 방을 다시 맞춤
  if ((name === "shop" || name === "deco") && profile.wallet?.key && (!profile.wallet.at || Date.now() - profile.wallet.at > 5 * 60 * 1000)) walletSync();
}

// ---------- 상점 ----------
const shopState = { tab: "pick", sel: null };
function openShop(tab = null, sel = null) {
  if (tab) shopState.tab = tab;
  shopState.sel = sel;
  previewDeco = sel && ITEM[sel] ? { [ITEM[sel].slot]: sel } : null;
  openSheet("shop");
  previewDeco = sel && ITEM[sel] ? { [ITEM[sel].slot]: sel } : null;
}
function renderShopUI() {
  renderShop($("shop-tabs"), $("shop-body"), {
    econ: profile.econ, state: shopState, isApp: IS_APP,
    gem: { online: gemOnline(), busy: gemBusy, buy: profile.wallet?.buy || "off", at: profile.wallet?.at || 0, pending: pendingGems(profile), has: !!profile.wallet?.created },
    onDeleteWallet: () => deleteWalletNow(),
    onUnlockTheme: (t) => openTheme(t),
    rerender: renderShopUI,
    onSelect: (it) => { previewDeco = it ? { [it.slot]: it.id } : null; },
    onEquip: (it) => { equip(profile.econ, it); persist(); sfx("tap"); say(`${josa(it.name, "을", "를")} 끼웠어요`, 2500); renderShopUI(); },
    onBuy: (it) => {
      if (it.price?.gem) { buyWithGem(it); return; }
      const r = buy(profile.econ, it, clock.now());
      if (!r.ok) { sfx("refuse"); say(r.reason === "poor" ? (it.price.gem ? "하트 보석이 모자라요" : "별사탕이 모자라요. 돌봄·놀이·산책으로 모아요") : "살 수 없어요"); return; }
      equip(profile.econ, it); persist(); sfx("win"); renderWallet();
      say(`${josa(it.name, "을", "를")} 샀어요! 방에 놓았어요`, 4000); renderShopUI();
    },
    onGoGem: () => { shopState.tab = "gem"; shopState.sel = null; previewDeco = null; renderShopUI(); },
    onPack: (pack) => buyPack(pack),
    onRestore: () => restorePurchases(),
  });
}
// 보석으로 꾸미기 사기: 서버 지갑이 잔액을 확인하고 빼고 물건을 적는다(한 번에). 연결이 없으면 못 산다
async function buyWithGem(it) {
  if (gemBusy) return;
  if (!navigator.onLine) { sfx("refuse"); say("하트 보석은 인터넷에 연결됐을 때만 쓸 수 있어요. 별사탕 상품은 언제나 살 수 있어요", 5000); return; }
  gemBusy = true; renderShopUI();
  try {
    const r = await wallet.spendGem(profile, wsave, it.id, it.price.gem);
    if (r.ok) { equip(profile.econ, it); persist(); sfx("win"); renderWallet(); say(`${josa(it.name, "을", "를")} 샀어요! 방에 놓았어요`, 4000); return; }
    sfx("refuse");
    const d = r.data || {};
    if (r.status === 0) say(d.error === "slow" ? "서버가 늦어요. 다시 누르면 이어서 확인해요(두 번 빠지지 않아요)" : "인터넷에 연결되지 않았어요. 연결된 뒤 다시 해 주세요", 5000);
    else if (r.status === 402) say("하트 보석이 모자라요", 3000);
    else if (d.reason === "owned") { equip(profile.econ, it); persist(); say("이미 가지고 있어요", 3000); }
    else if (d.reason === "price") say("가격이 바뀌었어요. 다시 확인해 주세요", 4000);
    else say(d.error || "지금은 살 수 없어요. 잠시 뒤 다시 해 주세요", 4000);
  } finally { gemBusy = false; renderWallet(); renderShopUI(); }
}
// 서버 지갑 지우기(처리방침 7번): 남은 보석·보석으로 산 꾸미기가 사라진다. 법정 보존 거래기록은 서버에 남음
async function deleteWalletNow() {
  if (!confirm("서버의 하트 보석 지갑을 지울까요? 남은 하트 보석과 하트 보석·결제로 얻은 꾸미기가 사라지고 되살릴 수 없어요.")) return;
  if (!(await wallet.deleteWallet(profile.wallet.key))) { say("지우지 못했어요. 인터넷 연결 뒤 다시 해 주세요", 4000); return; }
  profile.wallet = null; profile.walletEnc = null; delete profile.walletMergeFrom;
  reconcileOwned(profile.econ, [], []); profile.econ.gemFree = 0; profile.econ.gemPaid = 0;
  persist(); renderWallet(); renderShopUI(); say("서버 지갑을 지웠어요", 4000);
}
// 돈 결제: 웹에서는 안내만, 앱은 플레이 결제 → 서버 지갑이 적립(docs/wallet.md 2-4, 원화 결제는 서버가 구글로 확인하는 verify 모드에서만 연다)
const IS_APP = native.IS_APP;
let paying = false;
async function buyPack(pack) {
  sfx("tap");
  if (!IS_APP) { say(`${josa(pack.name, "은", "는")} 플레이스토어 앱에서 살 수 있어요(준비 중)`, 5000); return; }
  if (paying) return;
  if (pack.once && profile.econ.bought[pack.id]) { say("이미 산 상품이에요", 3000); return; }
  if (!navigator.onLine) { say("결제하려면 인터넷 연결이 필요해요", 4000); return; }
  paying = true;
  try {
    const c = await wallet.ensureWallet(profile, wsave); // 결제 전에 지갑이 있어야 함(구글에 지갑 대조값을 함께 보냄)
    if (!c.ok) { say("서버에 닿지 않아요. 인터넷 연결 뒤 다시 해 주세요", 5000); return; }
    if ((profile.wallet.buy || "off") === "off") { say("하트 보석 결제는 준비 중이에요", 4000); return; }
    const t = await native.payBuy(pack, await wallet.acctOf(profile.wallet.key));
    if (!t?.purchaseToken) { say("결제가 끝나지 않았어요", 4000); return; }
    if (!isPaid(t)) { say("결제가 확인되면 다음에 앱을 열 때 받아요", 6000); return; }
    profile.payPending = { ...(profile.payPending || {}), [t.purchaseToken]: { sku: pack.sku, at: Date.now(), orderId: t.orderId || null } }; persist(); // 지급 대기 먼저 저장
    await settlePurchase({ do: pack.once ? "ack" : "consume", token: t.purchaseToken, pack, orderId: t.orderId || null });
  } catch (e) {
    const msg = String(e?.message || e);
    if (/cancel/i.test(msg)) say("결제를 취소했어요", 3000);
    else if (/pending/i.test(msg)) say("결제가 확인되면 다음에 앱을 열 때 받아요", 6000); // 편의점 결제 등 대기 결제(전수 조사 C4)
    else if (/^credit:/.test(msg)) say("결제는 끝났어요. 인터넷이 연결되면 하트 보석이 들어와요", 7000);
    else if (/BILLING_UNAVAILABLE|unavailable/i.test(msg)) say("이 기기에서는 구글 결제를 쓸 수 없어요(플레이 스토어 로그인·제한 설정을 확인해 주세요)", 7000);
    else say("결제를 마치지 못했어요. 돈이 나갔다면 앱을 다시 열면 받아요", 7000);
    console.warn("결제 실패", e);
  } finally { paying = false; renderShopUI(); }
}
// 서버 지갑 적립 → 그 뒤 구글 소비(보석 묶음)·확인(시작 꾸러미). 어디서 끊겨도 지급 대기에 남아 다음에 앱을 열 때 이어서 한다
async function settlePurchase(job) {
  if (job.do !== "consumeOnly" && job.do !== "ackOnly") {
    const r = await wallet.creditPurchase(profile, wsave, { token: job.token, sku: job.pack.sku, orderId: job.orderId });
    if (!r.ok) {
      if (r.voided) { if (profile.payPending) delete profile.payPending[job.token]; persist(); say("결제가 취소되어 환불됐어요", 6000); return; }
      throw new Error("credit:" + (r.pending ? "pending" : r.reason || r.status)); // 지급 대기 유지
    }
    const first = !profile.econ.orders[job.token]; // 별사탕(꾸러미)은 기기 화폐라 이 기기 기록으로 한 번만
    if (first) {
      profile.econ.orders[job.token] = { at: Date.now(), sku: job.pack.sku, gems: job.pack.gems || 0, stars: job.pack.stars || 0, ...(job.orderId ? { orderId: String(job.orderId).slice(0, 64) } : {}) };
      profile.econ.star += job.pack.stars || 0;
    }
    if (r.first || first) { gainFx({ gem: r.first ? job.pack.gems || 0 : 0, star: first ? job.pack.stars || 0 : 0 }); sfx("win"); say(`${josa(job.pack.name, "을", "를")} 받았어요!`, 5000); }
    persist();
  }
  if (job.do === "grant") { /* 구글 소비는 이미 끝남 */ }
  else if (job.pack.once) { if (!job.acknowledged) { try { await native.payAck(job.token); } catch (e) { if (!/already/i.test(String(e?.message))) throw e; } } }
  else await native.payConsume(job.token);
  if (profile.payPending) delete profile.payPending[job.token];
  persist(); renderWallet(); cloudSync({ urgent: true });
}
async function reconcilePurchases({ manual = false } = {}) {
  if (!IS_APP) { if (manual) say("앱에서 산 상품을 다시 불러오는 기능이에요. 웹에서는 산 것이 없어요", 4000); return; }
  try {
    if (Object.keys(profile.payPending || {}).length && !(await wallet.ensureWallet(profile, wsave)).ok) { if (manual) say("서버에 닿지 않아요. 인터넷 연결 뒤 다시 해 주세요", 5000); return; }
    const jobs = planReconcile(await native.payList(), profile.econ, profile.payPending || {});
    for (const j of jobs) { try { await settlePurchase(j); } catch (e) { console.warn("결제 정리 실패", j, e); } }
    if (manual) { await walletSync(); say(jobs.length ? "산 상품을 다시 불러왔어요" : "새로 받을 상품이 없어요. 하트 보석은 서버 지갑에 있어요. 기기를 바꾸면 이어하기나 저장 코드로 옮기고, 잃어버렸으면 주문번호와 함께 이메일로 문의해 주세요", 8000); }
  } catch (e) { if (manual) say("구글 결제에 연결하지 못했어요. 잠시 뒤 다시 해 주세요", 5000); console.warn(e); }
}
function restorePurchases() { reconcilePurchases({ manual: true }); }
// 구매 장부: 지급 뒤 서버에 기록(전자상거래법 거래기록 5년 보존). 실패하면 저장해 두고 다음에 다시(지급은 막지 않음)
// (서버 지갑 이전 결제의 남은 보고만. 새 결제는 /wallet/purchase가 장부까지 적는다)
let acctCache = null;
async function payAcct() {
  if (acctCache) return acctCache;
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("acct:" + profile.deviceId));
  return (acctCache = [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join(""));
}
let reporting = false;
async function flushOrderReports() {
  if (reporting || !profile.payReport?.length || !navigator.onLine) return;
  reporting = true;
  try {
    const acct = await payAcct();
    while (profile.payReport.length) {
      const r = profile.payReport[0];
      const res = await fetch(PUSH_SERVER + "/billing/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...r, acct }) });
      if (!res.ok && res.status !== 400) break; // 서버 문제면 다음에(400은 버릴 기록)
      profile.payReport.shift(); saveProfile(profile);
    }
  } catch { /* 다음에 다시 */ } finally { reporting = false; }
}

// ---------- 꾸미기 모드 ----------
const decoState = { slot: "wall" };
function openDeco() { closeSheet(); openSheet("deco"); }
function renderDecoUI() {
  renderDeco($("deco-slots"), $("deco-strip"), {
    econ: profile.econ, state: decoState, rerender: renderDecoUI,
    onEquip: (it, slot) => { if (it) equip(profile.econ, it); else unequip(profile.econ, slot); persist(); sfx("tap"); renderDecoUI(); },
    onLocked: (it) => { openShop(TABS.find((t) => t.slots && t.slots.includes(it.slot))?.id || "pick", it.id); },
  });
}

// ---------- 메뉴: 간단 설정 ----------
const SLEEP_PRESETS = [["22:00", "06:00", "밤 10시"], ["23:00", "07:00", "11시"], ["00:00", "08:00", "12시"]];
function renderQuickSettings() {
  const s = profile.settings, box = $("quick-settings");
  const notifyOn = profile.push.subscribed && s.notify.enabled;
  box.innerHTML = `
    <div class="set">소리<button class="tg ${s.sound ? "on" : ""}" id="q-sound" aria-label="소리"></button></div>
    <div class="set">날씨<button class="tg ${s.weather !== false ? "on" : ""}" id="q-weather" aria-label="창밖 실제 날씨"></button></div>
    <div class="set">알림<button class="goarrow" id="q-notify">${notifyOn ? "켜짐" : "꺼짐"} ›</button></div>
    <div class="set">이어하기<button class="goarrow" id="q-cloud">${profile.cloud?.key ? "켜짐" : "꺼짐"} ›</button></div>
    <div class="set">잠자는 시간<span class="r">${SLEEP_PRESETS.map(([a, , l]) => `<button class="seg ${s.sleep.start === a ? "on" : ""}" data-sleep="${a}">${l}</button>`).join("")}</span></div>
    <p class="fine">자는 시간은 8시간이에요 (${s.sleep.start} → ${s.sleep.end}). 자는 동안엔 알림이 조용해요.</p>`;
  $("q-sound").addEventListener("click", () => { s.sound = !s.sound; setSoundEnabled(s.sound); if (s.sound) sfx("happy"); persist(); renderQuickSettings(); });
  $("q-notify").addEventListener("click", () => openSheet("notify"));
  // 날씨: 끄면 날씨 서비스로 아무것도 보내지 않음(처리방침 4절 약속, 디자인 자문 B2)
  $("q-weather").addEventListener("click", () => { s.weather = s.weather === false; persist(); updateWeather(true); sfx("tap"); say(s.weather ? "창밖에 실제 날씨를 보여 줘요" : "날씨를 껐어요. 날씨 서비스로 아무것도 보내지 않아요", 3000); renderQuickSettings(); });
  $("q-cloud").addEventListener("click", () => openSheet("cloud"));
  for (const b of box.querySelectorAll("[data-sleep]")) b.addEventListener("click", () => {
    const pr = SLEEP_PRESETS.find((x) => x[0] === b.dataset.sleep); s.sleep = { start: pr[0], end: pr[1] };
    if (profile.pet) advance(profile.pet, clock.now(), S());
    persist(); scheduleSync(500); renderQuickSettings(); sfx("tap");
  });
  $("gift-dot").hidden = !dailyStatus(profile.econ, clock.now()).available;
}

function renderHelp() {
  $("help-body").innerHTML = `
    <p class="small"><b>돌보기</b> 밥·놀기·씻기·불 버튼으로 돌봐요. 배고프거나 더러울 때 챙겨 주면 별사탕을 받아요.</p>
    <p class="small"><b>별사탕·하트 보석</b> 별사탕은 돌봄·놀이·산책·매일 선물로 모으고, 보석은 매일 선물 7일째·비밀 찾기로 받거나 살 수 있어요. 둘 다 꾸미기에만 쓰여요. 펫의 상태는 돈으로 바뀌지 않아요. 하트 보석은 인터넷에 연결됐을 때만 받고 쓸 수 있어요(별사탕은 언제나 돼요).</p>
    <p class="small"><b>꾸미기</b> 아래 꾸미기 버튼 → 칸을 골라 가진 것으로 바꿔요. 상점에서는 사기 전에 방에 미리 놓아 볼 수 있어요.</p>
    <p class="small"><b>개인정보</b> 이 게임은 이름·연락처 같은 개인정보를 모으지 않아요. 펫과 꾸미기 기록은 이 기기 안에 저장되고, 이어하기를 켜면 서버에도 보관돼요. 하트 보석 잔액과 기록은 서버 지갑에 보관돼요. 창밖 날씨를 보여 주려고 대략적인 위치(시간대 대표 도시)만 날씨 서비스로 보내요(메뉴 → 날씨에서 끌 수 있어요). <a href="https://ggah1911.github.io/pocket-pet/privacy.html" target="_blank" rel="noopener">개인정보 처리방침 전문</a></p>`;
}

// ---------- 매일 선물 ----------
// 매일 선물(전수 조사 B1): 이미 떠 있으면 또 안 띄움, 다른 창·카드가 열려 있으면 닫힌 뒤로 미룸, 받지 않고 닫으면 그날은 저절로 다시 안 띄움
let dailyPending = false, dailyDismissedDay = null;
const dayKey = () => new Date(clock.now()).toDateString();
function showDaily(force = false) {
  if (document.querySelector(".dexcard.daily")) return;
  const st = dailyStatus(profile.econ, clock.now());
  if (!st.available && !force) return;
  if (!force) {
    if (dailyDismissedDay === dayKey()) return;
    const busy = [...document.querySelectorAll(".sheet")].some((x) => !x.hidden) || [...document.querySelectorAll(".dexcard")].some((c) => !c.hidden) || mg || walking();
    if (busy) { dailyPending = true; return; }
  }
  dailyPending = false;
  const card = dailyCard({ status: st, onClose: () => { if (dailyStatus(profile.econ, clock.now()).available) dailyDismissedDay = dayKey(); }, onClaim: () => {
    const r = claimDaily(profile.econ, clock.now());
    if (r) {
      gainFx({ star: r.star || 0 }); sfx("win");
      if (r.gem) { earnGem("daily"); say(navigator.onLine ? `오늘의 선물: 하트 보석 ${r.gem}개!` : `오늘의 선물: 하트 보석 ${r.gem}개는 인터넷이 연결되면 들어와요`, 5000); }
      else say(`오늘의 선물: 별사탕 ${r.star}개`, 4000);
    }
    $("gift-dot").hidden = true;
  } });
  card.classList.add("daily");
  document.body.append(card);
}
function closeSheet() {
  if (previewDeco) previewDeco = null;
  for (const el of document.querySelectorAll(".sheet")) el.hidden = true;
  $("backdrop").hidden = true;
  fitCanvas();
  if (dailyPending) setTimeout(() => showDaily(), 400); // 창 때문에 미뤘던 선물
}

async function renderNotifyApp() {
  const box = $("notify-body");
  const perm = await native.notifyPermission();
  const on = profile.push.subscribed && perm === "granted";
  let html = on
    ? `<p class="ok">알림 켜짐 · 휴대폰 안에서 예약돼요(인터넷 없어도 와요)</p><button class="big" id="btn-test">시험 알림 (1분 뒤)</button><p class="small">누른 뒤 홈으로 나가서 1~2분 기다려 보세요. 휴대폰이 절전 중이면 몇 분 늦게 올 수 있어요.</p><button class="big ghost" id="btn-off">알림 끄기</button>`
    : `<p>상태: <b>${perm === "denied" ? "알림 막힘(휴대폰 설정 → 앱 → 알모찌 → 알림에서 허용해 주세요)" : "아직 안 켬"}</b></p><button class="big" id="btn-enable">알림 받기</button>`;
  html += `<p class="small dim">알림 종류마다 소리가 달라요. 휴대폰 설정 → 앱 → 알모찌 → 알림에서 종류별로 끄거나 소리를 바꿀 수 있어요.</p>`;
  box.innerHTML = html;
  $("btn-enable")?.addEventListener("click", async () => {
    const r = await native.askNotifyPermission();
    if (r === "granted") { profile.push.subscribed = true; persist(); await syncNow(); say("알림을 켰어요. 시험 알림으로 확인해 보세요", 6000); }
    else say("알림이 막혀 있어요. 휴대폰 설정에서 허용해 주세요", 6000);
    renderNotifyApp(); renderQuickSettings();
  });
  $("btn-test")?.addEventListener("click", async () => { await native.testLocal(profile.pet?.name); say("1분 뒤 시험 알림이 와요. 홈으로 나가서 기다려 보세요", 8000); });
  $("btn-off")?.addEventListener("click", async () => { profile.push.subscribed = false; persist(); await native.cancelLocal(); say("알림을 껐어요", 3000); renderNotifyApp(); renderQuickSettings(); });
}
function renderNotify() {
  profile.seenGuide = true; persist();
  if (IS_APP) { renderNotifyApp(); return; }
  const d = deviceInfo();
  const box = $("notify-body");
  let html = "";
  if (d.ios && !d.standalone) {
    html += `<p class="warn">iPhone은 <b>홈 화면에 추가</b>해야 알림이 와요.</p>
      <ol><li>사파리 아래쪽 <b>공유 버튼</b>(네모에 위쪽 화살표)을 눌러요</li><li><b>홈 화면에 추가</b>를 눌러요</li><li>홈 화면에 생긴 <b>알모찌</b> 아이콘으로 다시 열어요</li><li>거기서 ≡ 메뉴 → <b>알림</b> → <b>알림 받기</b>를 눌러요</li></ol>
      <p class="small">사파리에서 키우던 펫은 홈 화면 앱과 저장소가 따로예요. 옮기려면 여기(사파리)에서 ≡ → 저장 → <b>내보내기</b>로 코드를 복사하고, 홈 화면 앱에서 ≡ → 저장 → <b>불러오기</b>에 붙여 넣으세요.</p>`;
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


// 처음부터 다시: 펫만 지운다. 도감·화폐·산 꾸미기·찾은 비밀은 남긴다(산 것이 사라지면 안 됨)
function resetPet() {
  if (!confirm("지금 펫을 지우고 처음부터 시작할까요? (도감, 별사탕, 하트 보석, 꾸미기는 남아요)")) return;
  profile = resetProfile(profile); // 펫만 새로(store.js RESET_KEEP)
  persist(); closeSheet(); showStart(); renderStats();
  clearSchedule();
}

// ---------- 방 꾸밈: 장착한 꾸미기 + 상점 미리 보기 + 도감 보상(추억 액자) ----------
let previewDeco = null; // 상점에서 미리 놓아 보는 중인 상품 { slot: id }
let decoCache = { key: "", deco: {} };
function roomDeco() {
  const last = profile.collection[profile.collection.length - 1];
  const eq = profile.econ ? profile.econ.equipped : {};
  const k = `${profile.collection.length}|${Object.keys(profile.seen).length}|${JSON.stringify(eq)}|${JSON.stringify(previewDeco)}`;
  if (decoCache.key !== k) {
    const open = unlockedSet(profile);
    decoCache = { key: k, deco: {
      memory: open.has("frame") && last ? { key: last.key, look: last.look || {}, gold: open.has("goldFrame") } : null,
      deco: { ...eq, ...(previewDeco || {}) },
    } };
  }
  return decoCache.deco;
}

// ---------- 그리기 루프 ----------
function frame() {
  const p = profile.pet;
  const t = performance.now();
  let scene;
  if (p) {
    const lk = `${p.bornAt}|${p.weight}|${p.mistakes.total}`;
    if (lookCache.key !== lk) lookCache = { key: lk, look: lookOf(p) };
    scene = { stage: p.stage, branch: p.branch, theme: p.theme, poops: p.poops, poopSlots: syncPoopSlots(), asleep: p.asleep, lightOn: p.lightOn, sick: p.sick, mood: p.stats.mood, hunger: p.stats.hunger, napping: p.napLeft > 0, look: lookCache.look, face: pickFace(faces, p, t), ended: p.ended ? p.ended.type : null, ...roomDeco() };
  } else scene = { stage: "egg", theme: "animal", lightOn: true, mood: 100, hunger: 100, poopSlots: [], ...roomDeco() };
  if (scene.deco && scene.deco.furnR === "sofa") { // 소파 자리·좌석 높이(그리기와 같은 배치 함수)
    const L = roomLayout(view.w, view.h, scene.deco);
    scene.sofaDx = L.furnPos.furnR - L.cx; scene.sofaLift = (L.furnBase - 9) - L.baseY;
  }
  const fr = animFrame(anim, t, scene, { roam: Math.min(26, Math.round(view.w * 0.18)) });
  if (mg) mgFrame(fr, t);
  anim.inGame = !!mg;
  if (p && p.stage !== "egg" && !p.ended) { const sd = specialDay(new Date(clock.now())); if (sd) fr.hat = HAT_OF[sd]; } // 특별한 날 모자
  if (anim.cur && anim.cur.type === "butt" && p && !(profile.eggs && profile.eggs.butt)) discover("butt");
  const drawn = drawRoom(ctx, { ...view, now: t, scene, f: fr, wall: clock.now(), loc: profile.settings.location, weather: weatherNow });
  petBox = drawn.pet; poopRects = drawn.poops; windowBox = drawn.window; layout = drawn.layout; memoBox = drawn.memo;
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
  // 비밀: 11:11 / 22:22, 특별한 날
  const d = new Date(clock.now());
  const wk = wishTime(d);
  if (wk && wk !== lastWish && document.visibilityState === "visible" && p.stage !== "egg" && !p.asleep && !p.ended && !mg) {
    lastWish = wk;
    playAnim(anim, "wish", performance.now(), { text: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} 소원 시간!` });
    say("숫자가 나란히! 소원을 빌어 봐요", 6000); sfx("win"); discover("wish1111");
  }
  const sd = specialDay(d);
  if (sd && p.stage !== "egg" && !p.ended && !(profile.eggs && profile.eggs.special)) { say(SPECIAL_KO[sd], 6000); discover("special"); }
}

// ---------- 시작 ----------
// 앱 전용: 뒤로 가기(놀이 → 창 → 카드 → 홈으로), 백그라운드 전환, 알림 누름, 결제 정리
function bootApp() {
  native.onAppEvents({
    back: () => {
      if (mg) { endMinigame(true); return; }
      const card = [...document.querySelectorAll(".dexcard")].find((c) => !c.hidden);
      if (card) { card.querySelector(".x")?.click(); return; }
      if ([...document.querySelectorAll(".sheet")].some((x) => !x.hidden)) { closeSheet(); return; }
      native.minimizeApp();
    },
    pause: () => { profile.lastSeen = Date.now(); persist(); syncNow(); cloudSync({ urgent: true }); },
    resume: () => { tick(); native.clearDelivered(); syncNow(); reconcilePurchases(); flushOrderReports(); walletSync(); },
  });
  native.onNotifyTap(() => {
    if (profile.pet && profile.pet.stage !== "egg" && !profile.pet.asleep && !profile.pet.ended) {
      setTimeout(() => { playAnim(anim, "greetBig", performance.now()); say(`와 줬구나! ${I(profile.pet.name)} 기다렸어요`, 5000); }, 400);
    }
  });
  native.clearDelivered();
  if (profile.push.subscribed) syncNow();
  reconcilePurchases(); flushOrderReports();
}

function boot() {
  for (const btn of document.querySelectorAll("[data-icon]")) drawIcon(btn.querySelector("canvas"), SPRITES[btn.dataset.icon]);
  for (const btn of document.querySelectorAll("[data-act]")) btn.addEventListener("click", () => ACTIONS[btn.dataset.act]());
  for (const btn of document.querySelectorAll("[data-theme]")) btn.addEventListener("click", () => {
    if (!themeOpen(profile.econ, btn.dataset.theme)) { openTheme(btn.dataset.theme).then((ok) => { if (ok) btn.click(); }); return; } // 잠긴 알: 하트 보석으로 열기
    draft.theme = btn.dataset.theme; draft.eggColor = null;
    if (unlockedSet(profile).has("eggColor")) { renderEggStep(); stepTo("egg"); } else stepTo("speed");
  });
  for (const btn of document.querySelectorAll("[data-speed]")) btn.addEventListener("click", () => { draft.speed = btn.dataset.speed; stepTo("name"); });
  setSoundEnabled(profile.settings.sound);
  if (!profile.settings.location) { profile.settings.location = guessLocation(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date().getTimezoneOffset()); persist(); }
  updateWeather();
  setInterval(() => { if (document.visibilityState === "visible") updateWeather(); }, 5 * 60 * 1000);
  $("btn-start").addEventListener("click", startGame);
  $("mg-quit").addEventListener("click", () => endMinigame(true));
  $("btn-ending").addEventListener("click", finishEnding);
  $("btn-export").addEventListener("click", doExport);
  $("btn-import").addEventListener("click", doImport);
  $("name-input").addEventListener("keydown", (e) => { if (e.key === "Enter") startGame(); });
  $("btn-menu").addEventListener("click", () => openSheet("menu"));
  $("coin-star").addEventListener("click", () => openShop("pick"));
  $("coin-gem").addEventListener("click", () => openShop("gem"));
  $("tile-gift").addEventListener("click", () => { closeSheet(); showDaily(true); });
  $("btn-reset2").addEventListener("click", resetPet);
  for (const cv of document.querySelectorAll("canvas[data-sprite]")) { const sp = SPRITES[cv.dataset.sprite]; const big = spriteCanvas(cv.dataset.sprite, cv.dataset.sprite.startsWith("coin") ? 16 : 36, cv.dataset.sprite.startsWith("coin") ? 16 : 30); cv.width = big.width; cv.height = big.height; cv.getContext("2d").drawImage(big, 0, 0); }
  document.querySelector('[data-sheet="dex"] h2').addEventListener("click", () => { // 비밀: 도감 제목 5번
    if (streaks.dex.tap(performance.now())) { showNote("만든 사람의 편지", MAKER_LETTER); discover("maker"); setTimeout(renderDex, 50); }
  });
  $("backdrop").addEventListener("click", closeSheet);
  for (const btn of document.querySelectorAll("[data-open]")) btn.addEventListener("click", () => openSheet(btn.dataset.open));
  for (const sh of document.querySelectorAll(".sheet")) if (!sh.querySelector(".x")) { // 닫기는 어디서나 오른쪽 위 ✕ 하나
    const x = document.createElement("button"); x.className = "x"; x.textContent = "✕"; x.setAttribute("aria-label", "닫기"); x.dataset.close = ""; sh.prepend(x);
  }
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
    see(profile.pet);
    syncRewardItems();
    if (profile.pet.ended) setTimeout(startFarewell, 600);
    else {
      setTimeout(() => showDaily(), 1500); // 하루 한 번 매일 선물
      if (profile.pet.stage !== "egg" && !profile.pet.asleep && (fromPush || away >= 2 * 3600 * 1000)) {
        setTimeout(() => { if (!anim.cur) { playAnim(anim, fromPush ? "greetBig" : "greet", performance.now()); sfx("greet"); if (!sum) say(fromPush ? `와 줬구나! ${I(profile.pet.name)} 기다렸어요` : `${I(profile.pet.name)} 반가워해요`, 5000); } }, 700);
      }
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
    if (leaving) return;
    if (document.visibilityState === "hidden") { profile.lastSeen = Date.now(); persist(); syncNow({ keepalive: true }); cloudSync({ urgent: true, keepalive: true }); return; }
    cloudCheck(); // 다시 보일 때: 다른 기기 기록 확인(5분에 한 번까지)
    if (!profile.wallet?.at || Date.now() - profile.wallet.at > 5 * 60 * 1000 || profile.wallet?.queue?.length) walletSync();
    if (profile.pet && !profile.pet.ended && !document.querySelector(".dexcard")) showDaily(); // 날짜가 바뀐 뒤 다시 열면 선물
    else { tick(); updateWeather(); navigator.clearAppBadge?.().catch(() => {}); }
  });
  navigator.clearAppBadge?.().catch(() => {});
  const cloudMsg = sessionStorage.getItem("almochi:say"); if (cloudMsg) { sessionStorage.removeItem("almochi:say"); setTimeout(() => say(cloudMsg, 6000), 800); }
  cloudCheck({ atBoot: true });
  walletSync(); // 하트 보석 지갑: 받아 오기·옛 잔액 이관·대기 중인 적립 보내기
  window.addEventListener("online", () => walletSync());
  window.addEventListener("offline", () => { renderWallet(); if (!document.querySelector('[data-sheet="shop"]').hidden) renderShopUI(); });
  setInterval(() => syncNow(), 10 * 60 * 1000);
  setInterval(() => { if (document.visibilityState === "visible") profile.lastSeen = Date.now(); }, 30000);
  // 알림을 눌러서 앱이 앞으로 나오면 크게 반기기(서비스 워커가 알려 줌)
  navigator.serviceWorker?.addEventListener("message", (ev) => {
    if (ev.data?.type === "push-click" && profile.pet && profile.pet.stage !== "egg" && !profile.pet.asleep && !profile.pet.ended) {
      playAnim(anim, "greetBig", performance.now()); say(`와 줬구나! ${I(profile.pet.name)} 기다렸어요`, 5000);
    }
  });

  // 서비스 워커·알림 연결 확인(웹). 앱은 서비스 워커 없이 기기 안 알림
  if (!IS_APP) registerSW().then(async () => {
    if (profile.push.subscribed) {
      try { await ensurePush(profile.deviceId); await syncNow(); } catch (e) { console.warn(e); }
    }
  });
  else bootApp();

  // 개발 도구(공개 배포에는 없음): ?dev 로 열기
  if (QS.has("dev")) {
    window.__pp = { clock, getProfile: () => profile, tick, anim, playAnim: (n, d) => playAnim(anim, n, performance.now(), d), mg: () => mg, layout: () => layout, forceGame: null, boxes: () => ({ windowBox, petBox, memoBox }), render: () => renderStats() };
    import("./dev/panel.js?v=90736be-1791370074").then((m) => m.mount({ clock, getProfile: () => profile, tick, renderStats, syncNow, serverStatus })).catch(() => {});
  }
}

boot();
