// 화폐: 별사탕(무료)·하트 보석(유료). 화면과 분리된 순수 규칙.
// - 게임 수치(배부름 등)와는 섞지 않는다: 돈으로 펫 상태가 바뀌지 않는다.
// - 하트 보석은 산 것(gemPaid)과 받은 것(gemFree)을 따로 세고, 쓸 때는 받은 것부터 쓴다
//   (미사용 유료분 환불 계산이 쉽고 소비자에게 유리).
// 상세 근거: docs/plan-v2-release.md 1절

export const EARN = {
  care: { meal: 5, wash: 5, poop: 3, lightOff: 10, medicine: 5 }, // 필요한 돌봄을 했을 때만(판단은 호출하는 쪽)
  careCap: 60, // 돌봄 별사탕 하루 상한(연타 방지)
  playWin: 18, playLose: 8, walk: 20, // 평범한 하루 평균 150~250개가 되도록(시험: economy.test 하루 시나리오)
  playCap: 10, // 놀이·산책 보상은 하루 10번까지
  evolve: 30, dexNew: 20, eggFound: 15, eggFoundGem: 5, farewell: 100,
};

// 매일 선물: 7칸. 하루 빠져도 처음으로 안 돌아가고 다음 칸이 이어진다.
export const DAILY = [{ star: 30 }, { star: 30 }, { star: 40 }, { star: 40 }, { star: 50 }, { star: 60 }, { gem: 5 }];

export function newEcon() {
  return {
    star: 0, gemPaid: 0, gemFree: 0,
    owned: {}, // 상품 id → 얻은 시각
    equipped: {}, // 칸 → 상품 id
    daily: { lastDay: null, idx: 0, total: 0 },
    today: { day: null, care: 0, plays: 0 },
    bought: {}, // 1회 한정 상품(시작 꾸러미 등) id → 시각
    orders: {}, // 처리한 결제: 토큰 → { at, sku, gems, stars, orderId }(두 번 지급 방지 + 환불 문의 때 구글 주문번호와 대조). 옛 저장은 토큰 → 시각(숫자)
  };
}

// 옛 저장·손상된 값도 안전하게 채운다
export function normalizeEcon(e) {
  const base = newEcon();
  if (!e || typeof e !== "object") return base;
  const num = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return {
    star: num(e.star), gemPaid: num(e.gemPaid), gemFree: num(e.gemFree),
    owned: e.owned && typeof e.owned === "object" ? { ...e.owned } : {},
    equipped: e.equipped && typeof e.equipped === "object" ? { ...e.equipped } : {},
    daily: { ...base.daily, ...(e.daily || {}) },
    today: { ...base.today, ...(e.today || {}) },
    bought: e.bought && typeof e.bought === "object" ? { ...e.bought } : {},
    orders: e.orders && typeof e.orders === "object" ? { ...e.orders } : {},
  };
}

// 현지 날짜 키(하루 경계는 기기 시각 자정)
export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rollDay(e, now) {
  const k = dayKey(now);
  if (e.today.day !== k) e.today = { day: k, care: 0, plays: 0 };
}

export const gems = (e) => e.gemPaid + e.gemFree;

// 벌기. kind: "care"(sub: meal|wash|poop|lightOff|medicine) | "playWin" | "playLose" | "walk" | "evolve" | "dexNew" | "eggFound" | "farewell"
// 결과: { star, gem, capped }
export function earn(e, kind, now, sub = null) {
  rollDay(e, now);
  let star = 0, gem = 0, capped = false;
  if (kind === "care") {
    const want = EARN.care[sub] || 0;
    star = Math.max(0, Math.min(want, EARN.careCap - e.today.care));
    capped = star < want;
    e.today.care += star;
  } else if (kind === "playWin" || kind === "playLose" || kind === "walk") {
    if (e.today.plays >= EARN.playCap) capped = true;
    else { star = EARN[kind]; e.today.plays++; }
  } else if (kind === "eggFound") {
    star = EARN.eggFound; gem = EARN.eggFoundGem;
  } else if (kind in EARN && typeof EARN[kind] === "number") {
    star = EARN[kind];
  } else throw new Error(`earn: 모르는 종류 ${kind}`);
  e.star += star; e.gemFree += gem;
  return { star, gem, capped };
}

// 값 표기: { star: n } 또는 { gem: n }
export function canAfford(e, price) {
  if (!price) return true;
  if (price.star) return e.star >= price.star;
  if (price.gem) return gems(e) >= price.gem;
  return true;
}

// 쓰기: 보석은 받은 것부터
export function spend(e, price) {
  if (!canAfford(e, price)) return false;
  if (price.star) e.star -= price.star;
  if (price.gem) {
    const fromFree = Math.min(e.gemFree, price.gem);
    e.gemFree -= fromFree; e.gemPaid -= price.gem - fromFree;
  }
  return true;
}

// 상품 사기(별사탕·보석 상품). item: catalog의 상품
export function buy(e, item, now) {
  if (!item) return { ok: false, reason: "none" };
  if (e.owned[item.id]) return { ok: false, reason: "owned" };
  if (!item.price) return { ok: false, reason: "not-for-sale" };
  if (!spend(e, item.price)) return { ok: false, reason: "poor" };
  e.owned[item.id] = now;
  return { ok: true };
}

// 공짜로 얻기(기본 상품, 도감 보상, 꾸러미 등)
export function grant(e, id, now) {
  if (e.owned[id]) return false;
  e.owned[id] = now;
  return true;
}

export function equip(e, item) {
  if (!item || !e.owned[item.id]) return false;
  e.equipped[item.slot] = item.id;
  return true;
}
export function unequip(e, slot) { delete e.equipped[slot]; }

// 매일 선물
export function dailyStatus(e, now) {
  const today = dayKey(now);
  return { available: e.daily.lastDay !== today, idx: e.daily.idx % DAILY.length, rewards: DAILY };
}
export function claimDaily(e, now) {
  const st = dailyStatus(e, now);
  if (!st.available) return null;
  const r = DAILY[st.idx];
  if (r.star) e.star += r.star;
  if (r.gem) e.gemFree += r.gem;
  e.daily = { lastDay: dayKey(now), idx: (st.idx + 1) % DAILY.length, total: (e.daily.total || 0) + 1 };
  return { ...r, idx: st.idx };
}

// 돈 결제 지급(앱에서 구글이 "소모 완료"를 알린 뒤 부른다). pack: catalog의 보석 상품
export function grantPurchase(e, pack, token, now, { orderId = null } = {}) {
  if (!pack) return { ok: false, reason: "none" };
  if (token && e.orders[token]) return { ok: false, reason: "duplicate" };
  if (pack.once && e.bought[pack.id]) return { ok: false, reason: "once" };
  e.gemPaid += pack.gems || 0;
  e.star += pack.stars || 0;
  for (const id of pack.items || []) grant(e, id, now);
  if (pack.once) e.bought[pack.id] = now;
  if (token) e.orders[token] = { at: now, sku: pack.sku, gems: pack.gems || 0, stars: pack.stars || 0, ...(orderId ? { orderId: String(orderId).slice(0, 64) } : {}) };
  return { ok: true };
}

// 구매 기록 목록(최근 순). 옛 저장(토큰 → 시각 숫자)은 상품을 모르므로 시각만
export function purchaseHistory(e, limit = 20) {
  return Object.entries(e.orders || {}).map(([token, v]) => (typeof v === "number" ? { token, at: v } : { token, ...v }))
    .sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, limit);
}
