// 알림 받기: 서비스 워커 등록 → 푸시 구독 → 알림 서버에 구독·일정 올리기.
export const PUSH_SERVER = "https://pocket-pet-push.hwangi0404.workers.dev";

export function deviceInfo() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const iosVer = (ua.match(/OS (\d+)_(\d+)/) || []).slice(1).map(Number);
  return { ios, android, standalone, supported, iosVer, permission: "Notification" in window ? Notification.permission : "unsupported" };
}

let swReg = null;
export async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  try { swReg = await navigator.serviceWorker.register("sw.js"); return swReg; } catch (e) { console.warn("서비스 워커 등록 실패", e); return null; }
}

function b64ToBytes(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function api(path, method, body, { keepalive = false } = {}) {
  const res = await fetch(PUSH_SERVER + path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, keepalive });
  if (!res.ok) throw new Error(`알림 서버 ${res.status}`);
  return res.json();
}

// 반드시 버튼을 누른 직후에 불러야 한다(iPhone 규칙)
export async function enablePush(deviceId) {
  const info = deviceInfo();
  if (!info.supported) throw new Error(info.ios && !info.standalone ? "홈 화면에 추가한 뒤에 알림을 켤 수 있어요" : "이 브라우저는 알림을 지원하지 않아요");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("알림이 허용되지 않았어요. 휴대폰 설정에서 허용해 주세요");
  const reg = swReg || (await registerSW()) || (await navigator.serviceWorker.ready);
  const { publicKey } = await api("/vapid", "GET");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
  await api("/subscribe", "POST", { device: deviceId, subscription: sub.toJSON() });
  return true;
}

// 앱을 열 때마다: 허용돼 있는데 구독이 사라졌으면 다시 구독(iPhone은 가끔 구독을 지운다)
export async function ensurePush(deviceId) {
  if (deviceInfo().permission !== "granted") return false;
  const reg = swReg || (await navigator.serviceWorker.ready);
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { publicKey } = await api("/vapid", "GET");
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
  }
  await api("/subscribe", "POST", { device: deviceId, subscription: sub.toJSON() });
  return true;
}

export async function uploadSchedule(deviceId, notes, { keepalive = false } = {}) {
  const url = location.origin + location.pathname;
  const events = notes.map((n) => ({ at: n.at, title: n.title, body: n.body, tag: n.tag, badge: n.badge, urgent: n.urgent, url }));
  return api("/schedule", "PUT", { device: deviceId, events }, { keepalive });
}

export async function sendTest(deviceId, delaySec) {
  return api("/test", "POST", { device: deviceId, delaySec, body: delaySec ? `${delaySec}초 전에 예약한 시험 알림이에요. 앱을 닫아도 잘 와요!` : "알림이 잘 와요!" });
}

export async function serverStatus(deviceId) {
  return api(`/status?device=${deviceId}`, "GET");
}
