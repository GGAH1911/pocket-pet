// 방 여러 개(2026-10-09). econ.rooms[방id][칸] = 상품 id, econ.room = 지금 보는 방, econ.equipped = econ.rooms[econ.room](같은 객체).
// 머리 장식·놀이방 칸은 방과 상관없이 따라다닌다(GLOBAL). 한 물건은 한 방에만.
// 선물 방: 내 방 6칸(커튼·왼쪽·오른쪽·창가·벽걸이·바닥 소품)이 다 차고 매일 선물을 3번 이상 받았으면 한 번(econ.roomGift). 나머지는 보석 200(UNLOCKS room_*, 서버 지갑)
import { ROOMS, ROOM, ITEM } from "./catalog.js?v=2741bdf-1791555007";
export const GLOBAL_SLOTS = ["hat", "playL", "playM", "playR"];
export const FULL_SLOTS = ["curtain", "furnL", "furnR", "sill", "wallR", "prop"];
export const GIFT_MIN_DAYS = 3;
const basicsOf = (id) => { const r = ROOM[id] || ROOM.home; return { wall: r.wall, floor: r.floor, rug: "rug_pink" }; };

// 저장을 읽을 때(옛 저장: equipped만 있음 → 내 방)
export function normalizeRooms(e, raw = {}) {
  const rooms = raw.rooms && typeof raw.rooms === "object" ? Object.fromEntries(Object.entries(raw.rooms).filter(([k, v]) => ROOM[k] && v && typeof v === "object").map(([k, v]) => [k, { ...v }])) : {};
  const room = ROOM[raw.room] ? raw.room : "home";
  rooms[room] = { ...(rooms[room] || {}), ...(e.equipped || {}) }; // equipped가 지금 방의 최신 값
  if (!rooms.home) rooms.home = {};
  e.rooms = rooms; e.room = room; e.equipped = rooms[room];
  if (raw.roomGift && ROOM[raw.roomGift.id]) e.roomGift = { id: raw.roomGift.id, at: Number(raw.roomGift.at) || 0 };
  if (raw.roomOffered) e.roomOffered = Number(raw.roomOffered) || 1;
  return e;
}
export const hasRoom = (e, id) => id === "home" || (e.roomGift && e.roomGift.id === id) || !!e.owned[ROOM[id]?.unlock];
export const ownedRooms = (e) => ROOMS.filter((r) => hasRoom(e, r.id)).map((r) => r.id);
export const roomFull = (e, id = "home") => FULL_SLOTS.every((s) => (e.rooms?.[id] || {})[s]);
// 선물 방을 고를 수 있나: 아직 안 받았고, 내 방이 꽉 찼고, 매일 선물 3번 이상, 아직 안 가진 방이 있음
export const giftReady = (e) => !e.roomGift && roomFull(e, "home") && (e.daily?.total || 0) >= GIFT_MIN_DAYS && ROOMS.some((r) => !hasRoom(e, r.id));
export function chooseGift(e, id, now) {
  if (!giftReady(e) || !ROOM[id] || hasRoom(e, id)) return false;
  e.roomGift = { id, at: now };
  return true;
}
// 방 바꾸기: 머리·놀이방 칸은 들고 감. 처음 가는 방은 그 방 기본 벽지·바닥
export function switchRoom(e, id) {
  if (!ROOM[id] || !hasRoom(e, id) || e.room === id) return false;
  const carry = Object.fromEntries(GLOBAL_SLOTS.filter((s) => e.equipped[s]).map((s) => [s, e.equipped[s]]));
  for (const s of GLOBAL_SLOTS) delete e.equipped[s];
  const next = e.rooms[id] || (e.rooms[id] = { ...basicsOf(id) });
  for (const s of GLOBAL_SLOTS) delete next[s];
  Object.assign(next, carry);
  e.room = id; e.equipped = next;
  return true;
}
// 물건을 지금 방에 놓을 때 다른 방에서 빼기. 돌려줌: 빠진 방 id(없으면 null)
export function takeFromOtherRooms(e, item) {
  if (!item || GLOBAL_SLOTS.includes(item.slot)) return null;
  let from = null;
  for (const [rid, eq] of Object.entries(e.rooms || {})) {
    if (eq === e.equipped || eq[item.slot] !== item.id) continue;
    const b = basicsOf(rid)[item.slot];
    if (b) eq[item.slot] = b; else delete eq[item.slot];
    from = rid;
  }
  return from;
}
// 이 물건이 놓인 다른 방(꾸미기 목록 표시용)
export const placedElsewhere = (e, id) => { const it = ITEM[id]; if (!it || GLOBAL_SLOTS.includes(it.slot)) return null; for (const [rid, eq] of Object.entries(e.rooms || {})) if (eq !== e.equipped && eq[it.slot] === id) return rid; return null; };
export const roomBasic = (id, slot) => basicsOf(id)[slot] || null;
