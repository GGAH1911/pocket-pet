// 하트 보석 서버 지갑: 기기 쪽 순수 규칙(네트워크 없음). 설계 docs/wallet.md
// 보석 잔액과 보석·결제로 얻은 꾸미기는 서버가 정한다. 기기의 econ.gemFree/gemPaid는 서버 값의 사본(마지막으로 받은 값)일 뿐이다.
import { ITEM, ITEMS, PACKS, BASIC_EQUIP, UNLOCK, UNLOCKS, REVIVE, starSwapOf } from "./catalog.js?v=8143ed3-1791554505";
import { roomBasic } from "./rooms.js?v=8143ed3-1791554505";

export const gemPriceOf = (id) => { const sw = starSwapOf(id); if (sw) return sw.gem; if (/^revive_\d{10,14}(_\d{1,14})?$/.test(String(id))) return REVIVE.price.gem; if (/^candy_\d{10,14}(_\d{10,14})?(_[a-z0-9]{1,12})?$/.test(String(id))) return 60; const it = ITEM[id] || UNLOCK[id]; return it?.price?.gem > 0 ? it.price.gem : null; };
// 서버가 소유를 관리하는 상품: 보석 가격 상품 + 꾸러미로만 얻는 상품
export const SERVER_ITEMS = new Set([...ITEMS.filter((it) => gemPriceOf(it.id)).map((it) => it.id), ...UNLOCKS.map((u) => u.id), ...PACKS.flatMap((p) => p.items || [])]);
export const FRESH_MS = 10 * 60 * 1000; // 이만큼 지나면 숫자를 '확인 전'으로 흐리게

export function walletOf(profile) {
  if (!profile.wallet || typeof profile.wallet !== "object") profile.wallet = { key: null, queue: [] };
  if (!Array.isArray(profile.wallet.queue)) profile.wallet.queue = [];
  return profile.wallet;
}

// 서버 응답(요약)을 기기에 반영: 잔액 사본 + 서버 관리 상품 소유 맞추기
export function applyServerWallet(profile, resp, now = Date.now()) {
  if (!resp || !resp.w) return false;
  const wl = walletOf(profile), e = profile.econ;
  wl.free = resp.w.free; wl.paid = resp.w.paid; wl.rev = resp.w.rev; wl.at = now; wl.created = true;
  if (resp.buy) wl.buy = resp.buy;
  wl.closed = !!resp.closed; // 다른 지갑으로 합쳐져 닫힘 → 이 기기에서 보석·결제 막음(결제 감사 B-06)
  if (Array.isArray(resp.owned)) wl.owned = resp.owned;
  e.gemFree = Math.max(0, resp.w.free); e.gemPaid = resp.w.paid; // 사본(환불로 산 보석이 음수일 수 있음)
  if (Array.isArray(resp.owned)) reconcileOwned(e, resp.owned, resp.bought || []);
  return true;
}

// 서버 관리 상품(보석 상품·꾸러미 물건)만 서버 목록으로 맞춘다. 별사탕 상품·기본·도감 보상은 손대지 않는다.
// 서버에 없는 것을 끼고 있으면 기본 꾸미기(없으면 빈칸)로 되돌린다
export function reconcileOwned(e, owned, bought = [], now = Date.now()) {
  const want = new Set(owned.filter((id) => SERVER_ITEMS.has(id)));
  let changed = 0;
  for (const id of SERVER_ITEMS) {
    if (want.has(id) && !e.owned[id]) { e.owned[id] = now; changed++; }
    if (!want.has(id) && e.owned[id]) {
      delete e.owned[id]; changed++;
      const slot = ITEM[id]?.slot;
      for (const [rid, eq] of [["", e.equipped], ...Object.entries(e.rooms || {})]) if (slot && eq && eq[slot] === id) { const b = roomBasic(rid || e.room || "home", slot) || BASIC_EQUIP[slot]; if (b) eq[slot] = b; else delete eq[slot]; } // 모든 방에서
    }
  }
  for (const p of PACKS.filter((x) => x.once)) {
    if (bought.includes(p.id)) e.bought[p.id] = e.bought[p.id] || now; else delete e.bought[p.id];
  }
  return changed;
}

// 처음 지갑을 만들 때 옮길 기기 잔액(서버가 상한 안에서만 받는다)
export function migratePayload(e) {
  return { free: e.gemFree || 0, paid: e.gemPaid || 0, items: Object.keys(e.owned || {}).filter((id) => gemPriceOf(id)) };
}
// 지갑이 없을 때 만들어야 하나(옮길 옛 보석이나 보석 상품이 있으면)
export const needsWallet = (profile) => !profile.wallet?.key && ((profile.econ.gemFree || 0) + (profile.econ.gemPaid || 0) > 0 || migratePayload(profile.econ).items.length > 0);

// 보석 가격 상품 사기 버튼 상태
// online: 이번 실행에서 서버에 닿음(마지막 요청 성공), busy: 다른 보석 요청 중, total: 보석 수
export function gemButtonState({ online, busy, total, price }) {
  if (busy) return { label: "사는 중…", disabled: true };
  if (!online) return { label: "인터넷 연결 필요", disabled: true, hint: "하트 보석은 인터넷에 연결됐을 때만 쓸 수 있어요. 별사탕 상품은 언제나 살 수 있어요" };
  if (total < price) return { label: "모자라요", disabled: true, poor: true };
  return { label: "사기", disabled: false };
}

// 무료 보석 대기열(오프라인이면 쌓았다가 연결되면 보냄). 같은 알은 한 번만
export function queueEarn(profile, kind, id = null, op, now = Date.now(), extra = {}) {
  const q = walletOf(profile).queue;
  if (kind === "egg" && q.some((x) => x.kind === "egg" && x.id === id)) return false;
  q.push({ op, kind, id, at: now, ...extra });
  return true;
}
export const pendingGems = (profile) => (profile.wallet?.queue || []).length * 5;
