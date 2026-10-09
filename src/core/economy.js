// 화폐: 별사탕(무료)·하트 보석(유료). 화면과 분리된 순수 규칙.
// - 게임 수치(배부름 등)와는 섞지 않는다: 돈으로 펫 상태가 바뀌지 않는다.
// - 하트 보석은 산 것(gemPaid)과 받은 것(gemFree)을 따로 세고, 쓸 때는 받은 것부터 쓴다
//   (미사용 유료분 환불 계산이 쉽고 소비자에게 유리).
// 상세 근거: docs/plan-v2-release.md 1절
// 2026-10-06부터 하트 보석은 서버 지갑이 관리한다(docs/wallet.md): 여기서는 보석을 늘리거나 줄이지 않고 "받을 보석 수"만 돌려준다.
// gemFree/gemPaid는 서버 값의 사본. 보석 상품 사기·무료 보석 적립·결제 지급은 app/wallet.js가 서버를 거쳐 한다.
import { takeFromOtherRooms, normalizeRooms } from "./rooms.js?v=5644017-1791555167";

export const EARN = {
  care: { meal: 5, wash: 5, poop: 3, lightOff: 10, medicine: 5 }, // 필요한 돌봄을 했을 때만(판단은 호출하는 쪽)
  careCap: 60, // 돌봄 별사탕 하루 상한(연타 방지)
  playWin: 18, playLose: 8, walk: 20, // 평범한 하루 평균 150~250개가 되도록(시험: economy.test 하루 시나리오)
  playCap: 10, // 놀이·산책 보상은 하루 10번까지
  evolve: 30, dexNew: 20, eggFound: 15, eggFoundGem: 5, farewell: 100,
};

// 매일 선물: 7칸. 하루 빠져도 처음으로 안 돌아가고 다음 칸이 이어진다.
// 7일째(한 주 다 채운 칸)에 하트 보석 5 + 새 마음 사탕 1개 = 7번 받을 때마다 1개(하루 1번이라 일주일에 1개). 사용자 결정 + 경제 자문(2026-10-08)
export const DAILY = [{ star: 30 }, { star: 30 }, { star: 40 }, { star: 40 }, { star: 50 }, { star: 60 }, { gem: 5, candy: 1 }];
export const CANDY_MAX = 3; // 쌓아 둘 수 있는 최대(세대마다 쓸모 있는 갈림 2번 + 예비 1)

export function newEcon() {
  return {
    star: 0, gemPaid: 0, gemFree: 0,
    candy: 0, // 새 마음 사탕(이번 단계 실수 지우기) 가진 수
    owned: {}, // 상품 id → 얻은 시각
    equipped: {}, // 칸 → 상품 id
    daily: { lastDay: null, idx: 0, total: 0 },
    today: { day: null, care: 0, plays: 0 },
    bought: {}, // 1회 한정 상품(시작 꾸러미 등) id → 시각
    unlocks: {}, // 테마(알) 해금: 테마 → 시각. 동물은 늘 열림, 무지개 알(상상)은 별사탕으로 영구 해금(2026-10-06 사용자 제안·경제 자문)
    orders: {}, // 처리한 결제: 토큰 → { at, sku, gems, stars, orderId }(두 번 지급 방지 + 환불 문의 때 구글 주문번호와 대조). 옛 저장은 토큰 → 시각(숫자)
  };
}

// 옛 저장·손상된 값도 안전하게 채운다
export function normalizeEcon(e) {
  const base = newEcon();
  if (!e || typeof e !== "object") return base;
  const num = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const out = {
    star: num(e.star), gemPaid: num(e.gemPaid), gemFree: num(e.gemFree), candy: num(e.candy),
    owned: e.owned && typeof e.owned === "object" ? { ...e.owned } : {},
    equipped: e.equipped && typeof e.equipped === "object" ? { ...e.equipped } : {},
    daily: { ...base.daily, ...(e.daily || {}) },
    today: { ...base.today, ...(e.today || {}) },
    bought: e.bought && typeof e.bought === "object" ? { ...e.bought } : {},
    orders: e.orders && typeof e.orders === "object" ? { ...e.orders } : {},
    unlocks: e.unlocks && typeof e.unlocks === "object" ? { ...e.unlocks } : {},
    ...(typeof e.starSwapDay === "string" ? { starSwapDay: e.starSwapDay } : {}), // 별사탕 바꾸기 한 날(화면 표시용, 상한은 서버가 셈)
  };
  return normalizeRooms(out, e);

}

// ---- 새 마음 사탕: 이번 단계 돌봄 실수를 지움. 매일 선물 4일째에 1개, 더 필요하면 하트 보석으로 1개씩(사용자 결정 2026-10-08).
// 단계마다 1번, 평생 실수·숨은 친구 조건은 그대로(경제 자문) ----
export const FORGIVE = { id: "forgive", name: "새 마음 사탕", price: { gem: 60 } }; // 60 = 상점 최저 유료가(30이면 갈림을 싸게 상시 확정할 수 있어 올림, 경제 자문)
// 살수록 비싸짐: 60 → 90 → 120(그 뒤 120). 친구(세대)마다 처음 값으로: 새 알에서 태어난 친구는 60부터(2026-10-09 사용자 결정, 경제 자문 추천). 값은 서버가 정함
export const CANDY_PRICES = [60, 90, 120];
export const candyPrice = (buys) => CANDY_PRICES[Math.min(Math.max(0, buys | 0), CANDY_PRICES.length - 1)]; // price = 하트 보석으로 1개 살 때
export const stageTag = (pet) => `${pet.stage}|${pet.branch || ""}|${pet.ageMin - pet.stageMin}`; // 지금 단계를 가리키는 값(진화하면 바뀜)
export function forgiveState(e, pet) {
  if (!pet || pet.ended || pet.stage === "egg") return { ok: false, reason: "egg" };
  if ((pet.mistakes?.stage || 0) <= 0) return { ok: false, reason: "none" };
  if (pet.forgiven === stageTag(pet)) return { ok: false, reason: "used" };
  if ((e.candy || 0) <= 0) return { ok: false, reason: "nocandy", n: pet.mistakes.stage }; // 하트 보석으로 사서 먹일 수 있음
  return { ok: true, n: pet.mistakes.stage };
}
export function forgiveStage(e, pet) {
  const st = forgiveState(e, pet);
  if (!st.ok) return st;
  e.candy -= 1;
  pet.mistakes.stage = 0; // 평생 실수(total)는 그대로: 숨은 친구는 정말 실수 없이 키워야
  pet.forgiven = stageTag(pet);
  return { ok: true, n: st.n };
}

// ---- 알(테마) 해금: 처음엔 점박이 알(동물)만, 무지개 알(상상)은 하트 보석으로 한 번 열면 계속(뽑기·세대마다 재구매 없음) ----
// 사용자 결정(2026-10-06): 유료 화폐. 사기는 서버 지갑(catalog UNLOCKS 'theme_fantasy', 보석 150)이 하고, 산 것은 econ.owned에 서버 목록으로 맞춰진다.
// econ.unlocks[테마]는 잠금 전부터 그 테마를 키운 사람의 소급 해금(기기 기록)
export const THEME_UNLOCK = { fantasy: "theme_fantasy" };
export const themeOpen = (e, theme) => !THEME_UNLOCK[theme] || !!e.unlocks?.[theme] || !!e.owned?.[THEME_UNLOCK[theme]];

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
  e.star += star; // 보석(gem)은 서버 지갑에 적립 요청(호출하는 쪽)
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

// 상품 사기(별사탕 상품만). 보석 상품은 서버 지갑으로(reason "online")
export function buy(e, item, now) {
  if (!item) return { ok: false, reason: "none" };
  if (e.owned[item.id]) return { ok: false, reason: "owned" };
  if (!item.price) return { ok: false, reason: "not-for-sale" };
  if (item.price.gem) return { ok: false, reason: "online" };
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
  const from = takeFromOtherRooms(e, item); // 한 물건은 한 방에만(rooms.js)
  e.equipped[item.slot] = item.id;
  return from || true;
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
  if (r.star) e.star += r.star; // 보석 칸(r.gem)은 서버 지갑에 적립 요청(호출하는 쪽)
  // 사탕(r.candy)은 여기서 주지 않는다: 서버가 이 칸의 보석(주 1번 상한)을 받아 줄 때 함께 들어옴(기기 시계 앞당기기로 무한 획득 막기, app/wallet.js flushEarn)
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
