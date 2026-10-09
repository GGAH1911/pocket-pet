// 플레이 결제 판단(서버 없음). 실제 호출은 app/native.js, 여기서는 "무엇을 해야 하나"만 정한다.
// 규칙(docs/wallet.md 2-4): 결제 직후 토큰을 '지급 대기'(profile.payPending)에 먼저 저장 → 서버 지갑이 적립(econ.orders에 기록)
// → 그 뒤 구글 소비(consume, 보석 묶음)·확인(acknowledge, 시작 꾸러미). 앱이 중간에 꺼지면 켤 때·복원 때 이어서 한다.
// econ.orders[토큰]이 있으면 "서버 적립 끝, 소비만 남음"(consumeOnly).
import { PACKS } from "./catalog.js?v=9dda849-1791550733";

const BY_SKU = Object.fromEntries(PACKS.map((p) => [p.sku, p]));
export const packBySku = (sku) => BY_SKU[sku] || null;
// 안드로이드 purchaseState: "1" 결제 완료, "2" 결제 대기(편의점 결제 등). 대기는 지급하지 않는다.
export const isPaid = (t) => String(t?.purchaseState ?? "") === "1";

// 다른 기기 기록으로 바꿀 때, 이 기기에서 산 결제 기록과 꾸러미 별사탕을 옮겨 준다(전수 조사 S1).
// 하트 보석·꾸러미 꾸미기·1회 표시는 서버 지갑이 책임진다(지갑 합치기, docs/wallet.md): 여기서 다시 더하면 이미 쓴 보석이 되살아남(SEC-004)
// target·source는 econ. 돌려주는 값: 옮긴 결제 수
export function carryPurchases(target, source) {
  let n = 0;
  if (source?.unlocks) target.unlocks = { ...source.unlocks, ...(target.unlocks || {}) }; // 별사탕으로 연 알은 그대로
  for (const [token, rec] of Object.entries(source?.orders || {})) {
    if (target.orders?.[token]) continue;
    target.orders = target.orders || {};
    target.orders[token] = rec;
    const pack = typeof rec === "object" ? packBySku(rec.sku) : null;
    if (pack) target.star = (target.star || 0) + (pack.stars || 0); // 별사탕은 기기 화폐
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
    if (econ.orders?.[t.purchaseToken]) { // 서버 적립은 했는데 소비·확인이 안 끝난 것
      if (!pack.once) jobs.push({ do: "consumeOnly", token: t.purchaseToken, pack });
      else if (!t.isAcknowledged) jobs.push({ do: "ackOnly", token: t.purchaseToken, pack }); // 확인 안 하면 구글이 3일 뒤 자동 환불
      continue;
    }
    jobs.push({ do: pack.once ? "ack" : "consume", token: t.purchaseToken, pack, acknowledged: !!t.isAcknowledged, orderId: t.orderId || null });
  }
  // 지급 대기에 있는데 구글 목록에서 사라진 것: 서버 적립 → 소비 순서라, 적립 기록(econ.orders)이 없는데 사라졌다면 환불·취소된 것(결제 감사 B-01).
  // 지급하지 않고 대기에서 지운다. 적립은 됐는데(orders 있음) 사라진 것 = 소비까지 끝난 것 → 대기만 지운다
  for (const [token, rec] of Object.entries(pending || {})) {
    if (seen.has(token)) continue;
    jobs.push({ do: econ.orders?.[token] ? "clear" : "gone", token, pack: packBySku(rec?.sku), orderId: rec?.orderId || null });
  }
  return jobs;
}
