// 안드로이드 앱(Capacitor)에서만 쓰는 기능. 웹에서는 window.Capacitor가 없어 IS_APP=false, 모든 함수가 아무 일도 안 한다.
// 번들러가 없으므로 플러그인은 이름으로 등록한다(Capacitor.registerPlugin). 근거: docs/m8-plan.md
const C = globalThis.Capacitor;
export const IS_APP = !!C?.isNativePlatform?.();
const plug = (name) => (IS_APP ? C.registerPlugin(name) : null);
const Prefs = plug("Preferences");
const LN = plug("LocalNotifications");
const Pay = plug("NativePurchases");
const App = plug("App");

// ---------- 저장: localStorage + Preferences 이중 저장 ----------
// WebView 저장소는 OS가 공간이 부족할 때 지울 수 있다. 앱을 켤 때 비어 있으면 Preferences에서 되살린다.
export async function restoreSave(keys) {
  if (!IS_APP) return false;
  let restored = false;
  for (const k of keys) {
    try {
      if (localStorage.getItem(k)) continue;
      const { value } = await Prefs.get({ key: k });
      if (value) { localStorage.setItem(k, value); restored = true; }
    } catch { /* 되살리기 실패는 새로 시작 */ }
  }
  return restored;
}
export function mirrorSave(key, value) { if (IS_APP) Prefs.set({ key, value }).catch(() => {}); }

// ---------- 기기 안 알림 ----------
// 소리는 채널에 붙고 한 번 만든 채널은 못 바꾼다 → 소리를 바꾸면 채널 id 뒤 숫자를 올린다.
export const CHANNELS = [
  { id: "urgent1", name: "급한 알림", description: "울거나 아프거나 불을 꺼야 할 때", importance: 4, sound: "almochi_urgent.wav", vibration: true, visibility: 1 },
  { id: "care1", name: "돌봄 알림", description: "배고픔·놀기·똥·씻기", importance: 3, sound: "almochi_care.wav", vibration: true, visibility: 1 },
  { id: "good1", name: "좋은 소식", description: "알이 깨어남·자람·낮잠에서 깸", importance: 3, sound: "almochi_good.wav", vibration: false, visibility: 1 },
];
const GOOD = new Set(["hatch", "evolve", "napEnd"]);
// 묶인 알림은 가장 급한 종류의 채널로(notify.js가 kinds를 급한 순서로 정렬해 둠)
export function channelFor(note) {
  if (note.urgent) return "urgent1";
  if ((note.kinds || []).every((k) => GOOD.has(k))) return "good1";
  return "care1";
}
const MAX_SCHEDULED = 64;
const TEST_ID = 9000;
export function toLocal(notes, now) {
  return notes.filter((n) => n.at > now).slice(0, MAX_SCHEDULED).map((n, i) => ({
    id: i + 1, title: n.title, body: n.body, channelId: channelFor(n),
    schedule: { at: new Date(n.at), allowWhileIdle: true },
    isExactNotification: false, // 정확 알람 권한을 쓰지 않음(정책상 게임은 정당화 안 됨). 조금 늦게 올 수 있음
    smallIcon: "ic_stat_almochi", extra: { kinds: n.kinds },
  }));
}
export async function notifyPermission() {
  if (!IS_APP) return "unsupported";
  try { return (await LN.checkPermissions()).display; } catch { return "unsupported"; }
}
export async function askNotifyPermission() {
  if (!IS_APP) return "unsupported";
  const r = await LN.requestPermissions();
  if (r.display === "granted") await ensureChannels();
  return r.display;
}
let channelsMade = false;
export async function ensureChannels() {
  if (!IS_APP || channelsMade) return;
  for (const ch of CHANNELS) await LN.createChannel(ch);
  channelsMade = true;
}
// 앱을 열 때·닫을 때마다: 예약된 것을 모두 지우고 새 예측으로 다시 예약(묵은 알림이 쌓이지 않게)
export async function scheduleLocal(notes, now) {
  if (!IS_APP) return 0;
  await ensureChannels();
  const { notifications } = await LN.getPending();
  const old = notifications.filter((n) => n.id !== TEST_ID);
  if (old.length) await LN.cancel({ notifications: old.map((n) => ({ id: n.id })) });
  const list = toLocal(notes, now);
  if (list.length) await LN.schedule({ notifications: list });
  return list.length;
}
export async function cancelLocal() {
  if (!IS_APP) return;
  const { notifications } = await LN.getPending();
  if (notifications.length) await LN.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
}
export async function testLocal(name, seconds = 60) {
  await ensureChannels();
  await LN.schedule({ notifications: [{ id: TEST_ID, title: name || "알모찌", body: "시험 알림이에요. 잘 와요!", channelId: "care1", schedule: { at: new Date(Date.now() + seconds * 1000), allowWhileIdle: true }, isExactNotification: false, smallIcon: "ic_stat_almochi" }] });
}
export async function clearDelivered() { if (IS_APP) try { await LN.removeAllDeliveredNotifications(); } catch { /* 무시 */ } }
export function onNotifyTap(cb) { if (IS_APP) LN.addListener("localNotificationActionPerformed", cb); }

// ---------- 플레이 결제 ----------
// 플러그인(@capgo/native-purchases 8.8.1)은 호출마다 결제 연결을 닫고 새로 열어서, 두 호출이 겹치면 서로의 연결을 닫는다(결제 감사 B-02).
// 그래서 모든 결제 호출을 한 줄로 세운다.
let payChain = Promise.resolve();
const serial = (fn) => { const p = payChain.then(fn, fn); payChain = p.catch(() => {}); return p; };
export async function payBuy(pack, acct = null) {
  // 소모성도 isConsumable:false로 사고, 지급 대기 저장 → 서버 적립 → 소비 순서는 부르는 쪽(main.js)이 지킨다
  // acct: 지갑 열쇠 해시(구글 obfuscatedAccountId, 개인정보 아님)
  return serial(() => Pay.purchaseProduct({ productIdentifier: pack.sku, productType: "inapp", isConsumable: false, autoAcknowledgePurchases: false, ...(acct ? { appAccountToken: acct } : {}) }));
}
export const payConsume = (token) => serial(() => Pay.consumePurchase({ purchaseToken: token }));
export const payAck = (token) => serial(() => Pay.acknowledgePurchase({ purchaseToken: token }));
export async function payList() { return (await serial(() => Pay.getPurchases({ productType: "inapp" }))).purchases || []; }
// 플러그인 오류 종류: 실제 플러그인은 message가 아니라 code에 넣는다(취소 = code USER_CANCELED, message "Purchase is not purchased", 결제 감사 B-03)
export function payErrorKind(e) {
  const code = String(e?.code || ""), msg = String(e?.message || e || "");
  if (code === "USER_CANCELED") return "cancel";
  if (code === "ITEM_ALREADY_OWNED") return "owned";
  if (/pending/i.test(msg)) return "pending"; // 대기 결제(편의점 등)는 reject("Purchase is pending")
  if (code === "BILLING_UNAVAILABLE" || /^BILLING_SETUP/.test(code) || /Billing is not available/i.test(msg)) return "unavailable";
  if (/SERVICE_UNAVAILABLE|NETWORK_ERROR|SERVICE_DISCONNECTED|SERVICE_TIMEOUT/.test(code)) return "network";
  if (code === "ITEM_UNAVAILABLE") return "item";
  return "other";
}
export async function payAvailable() { if (!IS_APP) return false; try { return !!(await Pay.isBillingSupported()).isBillingSupported; } catch { return false; } }

// ---------- 앱 생명주기·뒤로 가기 ----------
export function onAppEvents({ back, pause, resume }) {
  if (!IS_APP) return;
  if (back) App.addListener("backButton", back); // 등록하면 기본 동작(앱 종료)이 꺼진다
  if (pause) App.addListener("pause", pause);
  if (resume) App.addListener("resume", resume);
}
export const minimizeApp = () => App.minimizeApp();
