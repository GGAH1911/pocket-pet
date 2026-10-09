// 저장: 휴대폰 브라우저 저장소(localStorage). 직전 저장본을 백업으로 하나 더 둔다.
import { DEFAULT_SETTINGS } from "../core/rules.js?v=06aede1-1791546909";
import { SAVE_VERSION, migratePet } from "../core/state.js?v=06aede1-1791546909";
import { newEcon, normalizeEcon, grant, equip } from "../core/economy.js?v=06aede1-1791546909";
import { ensureBasics, ITEM } from "../core/catalog.js?v=06aede1-1791546909";

const KEY = "pocket-pet:save";
const BACKUP = "pocket-pet:save:backup";
export const SAVE_KEYS = [KEY, BACKUP];
// 앱에서는 저장할 때마다 기기 저장소(Preferences)에도 같은 내용을 쓴다(main.js가 연결)
let mirror = null;
export function setSaveMirror(fn) { mirror = fn; }

function newDeviceId() {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function freshProfile() {
  const econ = newEcon(); ensureBasics(econ, Date.now());
  return { version: SAVE_VERSION, deviceId: newDeviceId(), pet: null, settings: structuredClone(DEFAULT_SETTINGS), push: { subscribed: false }, seenGuide: false, collection: [], seen: {}, ui: { poopSlots: [] }, econ };
}

export function migrateProfile(p) { return migrate(p); }

// '처음부터 다시': 펫만 새로. 기기·설정·도감·화폐·꾸미기·비밀과 이어하기 연결·결제 지급 대기·거래기록 보고 대기열은 지킨다(전수 조사 A1)
export const RESET_KEEP = ["deviceId", "push", "settings", "collection", "seen", "econ", "eggs", "cloud", "payPending", "payReport", "wallet", "walletEnc", "walletMergeFrom", "village", "villageSwapDay", "frameChoice"];
export function resetProfile(p) {
  const out = { ...freshProfile(), seenGuide: true };
  for (const k of RESET_KEEP) if (p[k] !== undefined) out[k] = p[k];
  return out;
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
  p.village = Array.isArray(p.village) ? p.village.filter((v) => v && v.pet && (v.pet = migratePet(v.pet))) : []; // 친구 마을
  // 화폐·꾸미기(2026-10-05 M7): 없으면 새로, 있으면 손상 값 정리. 기본 상품은 늘 가짐
  p.econ = normalizeEcon(p.econ);
  ensureBasics(p.econ, Date.now());
  // 무지개 알 잠금(2026-10-06) 전부터 상상 테마를 키운 적 있으면 공짜로 열어 둔다(이미 받은 걸 뺏지 않게)
  if (!p.econ.unlocks.fantasy && (p.pet?.theme === "fantasy" || Object.keys(p.seen || {}).some((k) => k.startsWith("fantasy.")) || (p.collection || []).some((c) => c?.theme === "fantasy")))
    p.econ.unlocks.fantasy = Date.now();
  if (p.settings.rug === "star") { grant(p.econ, "rug_star", Date.now()); equip(p.econ, ITEM.rug_star); delete p.settings.rug; } // 옛 '별 러그 깔기' 설정 → 상품으로
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
  if (mirror) { if (prev) mirror(BACKUP, prev); mirror(KEY, s); }
}

// 저장 내보내기/불러오기: 글자 코드(기기 변경, 사파리 → 홈 화면 앱 옮기기, 저장소 삭제 대비)
export function exportCode(p) {
  // 기기마다 다른 것(알림 연결·이어하기 코드·결제 지급 대기·거래기록 보고 대기열)은 코드에 넣지 않는다(코드를 남에게 줘도 서버 기록에 닿지 않게, 전수 조사 B10)
  // 하트 보석 지갑 열쇠는 넣는다(사파리 → 홈 화면 앱처럼 저장소가 갈려도 보석을 잃지 않게. 코드 화면에 "남에게 주지 마세요" 안내, docs/wallet.md 2-1)
  const { cloud, payPending, payReport, wallet, walletEnc, walletMergeFrom, ...rest } = p;
  const json = JSON.stringify({ app: "pocket-pet", v: SAVE_VERSION, at: Date.now(), profile: { ...rest, push: { subscribed: false }, ...(wallet?.key ? { wallet: { key: wallet.key } } : {}) } });
  const bytes = new TextEncoder().encode(json);
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return "PP1." + btoa(bin);
}

export function importCode(code, current) {
  const raw = String(code || "").trim().replace(/\s+/g, "");
  if (!raw.startsWith("PP1.")) throw new Error("알모찌 저장 코드가 아니에요");
  let data;
  try {
    const bin = atob(raw.slice(4));
    data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch { throw new Error("코드가 깨졌어요. 전부 복사했는지 확인해 주세요"); }
  if (data.app !== "pocket-pet" || !data.profile) throw new Error("알모찌 저장 코드가 아니에요");
  const p = migrate(data.profile);
  if (!p) throw new Error("읽을 수 없는 저장이에요");
  // 이 기기의 알림 연결은 그대로 둔다
  p.deviceId = current.deviceId; p.push = current.push;
  p.cloud = current.cloud; p.payPending = current.payPending; p.payReport = current.payReport;
  p.walletIncoming = p.wallet?.key || null; // 코드에 든 지갑으로 바꿀지는 main.js adoptWallet이 정함
  p.wallet = current.wallet; p.walletEnc = null; p.walletMergeFrom = current.walletMergeFrom;
  return p;
}
