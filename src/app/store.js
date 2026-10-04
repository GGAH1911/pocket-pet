// 저장: 휴대폰 브라우저 저장소(localStorage). 직전 저장본을 백업으로 하나 더 둔다.
import { DEFAULT_SETTINGS } from "../core/rules.js?v=fb4c507-1791115840";
import { SAVE_VERSION } from "../core/state.js?v=fb4c507-1791115840";

const KEY = "pocket-pet:save";
const BACKUP = "pocket-pet:save:backup";

function newDeviceId() {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function freshProfile() {
  return { version: SAVE_VERSION, deviceId: newDeviceId(), pet: null, settings: structuredClone(DEFAULT_SETTINGS), push: { subscribed: false }, seenGuide: false };
}

function migrate(p) {
  // 버전이 오르면 여기서 옛 저장을 새 모양으로 바꾼다
  if (!p || typeof p !== "object") return null;
  if (!p.deviceId) p.deviceId = newDeviceId();
  p.settings = { ...structuredClone(DEFAULT_SETTINGS), ...(p.settings || {}) };
  p.push = p.push || { subscribed: false };
  if (p.pet && p.pet.version !== SAVE_VERSION) p.pet = null; // M2 시제품: 옛 펫은 버린다
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
