// 저장: 휴대폰 브라우저 저장소(localStorage). 직전 저장본을 백업으로 하나 더 둔다.
import { DEFAULT_SETTINGS } from "../core/rules.js?v=f6105a2-1791123013";
import { SAVE_VERSION, migratePet } from "../core/state.js?v=f6105a2-1791123013";

const KEY = "pocket-pet:save";
const BACKUP = "pocket-pet:save:backup";

function newDeviceId() {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function freshProfile() {
  return { version: SAVE_VERSION, deviceId: newDeviceId(), pet: null, settings: structuredClone(DEFAULT_SETTINGS), push: { subscribed: false }, seenGuide: false, collection: [], seen: {}, ui: { poopSlots: [] } };
}

function migrate(p) {
  // 버전이 오르면 여기서 옛 저장을 새 모양으로 바꾼다
  if (!p || typeof p !== "object") return null;
  if (!p.deviceId) p.deviceId = newDeviceId();
  p.settings = { ...structuredClone(DEFAULT_SETTINGS), ...(p.settings || {}) };
  p.settings.sleep = { ...DEFAULT_SETTINGS.sleep, ...(p.settings.sleep || {}) };
  p.settings.busy = { ...DEFAULT_SETTINGS.busy, ...(p.settings.busy || {}) };
  p.settings.notify = { ...DEFAULT_SETTINGS.notify, ...(p.settings.notify || {}) };
  p.push = p.push || { subscribed: false };
  p.collection = Array.isArray(p.collection) ? p.collection : [];
  p.seen = p.seen && typeof p.seen === "object" ? p.seen : {};
  p.ui = p.ui || { poopSlots: [] };
  if (p.pet) p.pet = migratePet(p.pet); // 옛 펫도 버리지 않고 새 모양으로 바꾼다(알 수 없는 버전만 null)
  p.version = SAVE_VERSION;
  return p;
}

export function loadProfile() {
  for (const k of [KEY, BACKUP]) {
    try { const p = migrate(JSON.parse(localStorage.getItem(k))); if (p) return p; } catch { /* 손상 → 다음 후보 */ }
  }
  return freshProfile();
}

export function saveProfile(p) {
  const s = JSON.stringify(p);
  const prev = localStorage.getItem(KEY);
  if (prev) localStorage.setItem(BACKUP, prev);
  localStorage.setItem(KEY, s);
}

// 저장 내보내기/불러오기: 글자 코드(기기 변경, 사파리 → 홈 화면 앱 옮기기, 저장소 삭제 대비)
export function exportCode(p) {
  const json = JSON.stringify({ app: "pocket-pet", v: SAVE_VERSION, at: Date.now(), profile: { ...p, push: { subscribed: false } } });
  const bytes = new TextEncoder().encode(json);
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return "PP1." + btoa(bin);
}

export function importCode(code, current) {
  const raw = String(code || "").trim().replace(/\s+/g, "");
  if (!raw.startsWith("PP1.")) throw new Error("포켓 펫 저장 코드가 아니에요");
  let data;
  try {
    const bin = atob(raw.slice(4));
    data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch { throw new Error("코드가 깨졌어요. 전부 복사했는지 확인해 주세요"); }
  if (data.app !== "pocket-pet" || !data.profile) throw new Error("포켓 펫 저장 코드가 아니에요");
  const p = migrate(data.profile);
  if (!p) throw new Error("읽을 수 없는 저장이에요");
  // 이 기기의 알림 연결은 그대로 둔다
  p.deviceId = current.deviceId; p.push = current.push;
  return p;
}
