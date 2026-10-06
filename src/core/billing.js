// 플레이 결제 판단(서버 없음). 실제 호출은 app/native.js, 여기서는 "무엇을 해야 하나"만 정한다.
// 규칙(docs/m8-plan.md): 하트 보석 묶음(소모성)은 구글이 소비(consume)를 확인한 뒤에만 지급.
// 시작 꾸러미(비소모성, 한 번)는 확인(acknowledge) 후 지급. 돈은 냈는데 앱이 꺼진 경우를 위해
// 결제 직후 토큰을 '지급 대기'(profile.payPending)에 먼저 저장하고, 앱을 켤 때·복원 때 다시 맞춘다.
import { PACKS } from "./catalog.js?v=4036598-1791263909";

const BY_SKU = Object.fromEntries(PACKS.map((p) => [p.sku, p]));
export const packBySku = (sku) => BY_SKU[sku] || null;
// 안드로이드 purchaseState: "1" 결제 완료, "2" 결제 대기(편의점 결제 등). 대기는 지급하지 않는다.
export const isPaid = (t) => String(t?.purchaseState ?? "") === "1";

// 다른 기기 기록으로 바꿀 때, 이 기기에서 산 것 중 그 기록에 없는 결제를 옮겨 준다(돈 낸 보석이 덮여 사라지지 않게, 전수 조사 S1).
// target·source는 econ. 돌려주는 값: 옮긴 결제 수
export function carryPurchases(target, source, now = Date.now()) {
  let n = 0;
  for (const [token, rec] of Object.entries(source?.orders || {})) {
    if (target.orders?.[token]) continue;
    target.orders = target.orders || {};
    target.orders[token] = rec;
    const pack = typeof rec === "object" ? packBySku(rec.sku) : null;
    if (pack) {
      target.gemPaid = (target.gemPaid || 0) + (pack.gems || 0);
      target.star = (target.star || 0) + (pack.stars || 0);
      for (const id of pack.items || []) if (!target.owned?.[id]) { target.owned = target.owned || {}; target.owned[id] = now; }
      if (pack.once) { target.bought = target.bought || {}; target.bought[pack.id] = target.bought[pack.id] || rec.at || now; }
    }
    n++;
  }
  return n;
}

// purchases: getPurchases() 결과(아직 소비 안 된 것들), pending: profile.payPending {token: {sku, at}}
// 돌려주는 일: consume(소비 후 지급) / ack(확인 후 지급) / grant(이미 소비됨 → 지급만)
export function planReconcile(purchases, econ, pending = {}) {
  const jobs = [], seen = new Set();
  for (const t of purchases || []) {
    const pack = packBySku(t.productIdentifier);
    if (!pack || !t.purchaseToken) continue;
    seen.add(t.purchaseToken);
    if (!isPaid(t)) continue;
    if (econ.orders?.[t.purchaseToken]) { if (!pack.once) jobs.push({ do: "consumeOnly", token: t.purchaseToken, pack }); continue; } // 지급은 했는데 소비가 안 끝난 것
    jobs.push({ do: pack.once ? "ack" : "consume", token: t.purchaseToken, pack, acknowledged: !!t.isAcknowledged, orderId: t.orderId || null });
  }
  // 지급 대기에 있는데 목록에서 사라진 것 = 소비가 이미 끝났다(앱이 지급 직전에 꺼짐) → 지급만
  for (const [token, rec] of Object.entries(pending || {})) {
    if (seen.has(token) || econ.orders?.[token]) continue;
    const pack = packBySku(rec?.sku);
    if (pack && !pack.once) jobs.push({ do: "grant", token, pack, orderId: rec?.orderId || null });
  }
  return jobs;
}
