// 놀러 오기 코드(2026-10-09 사용자 요청 "친구 초대", 디자인·아동 심리 자문 3단계). 서버 없이 겉모습만 담은 5글자.
// 담는 것: 모습 종류·알 무늬 색·통통함·꼬질함. 이름·글·숫자(스탯)·주인 정보는 안 담는다 → 가짜 코드를 넣어도 모르는 모습 하나가 놀러 올 뿐.
// 아이 안전: 채팅·선물·친구 수·순위·읽음·답방 요구 없음. 손님은 내 펫 숫자에 영향 없음.
export const VISIT_KEYS = [
  "animal.baby", "animal.child", "animal.teen.good", "animal.teen.normal", "animal.adult.A", "animal.adult.B", "animal.adult.C", "animal.adult.D", "animal.adult.S",
  "fantasy.baby", "fantasy.child", "fantasy.teen.good", "fantasy.teen.normal", "fantasy.adult.A", "fantasy.adult.B", "fantasy.adult.C", "fantasy.adult.D", "fantasy.adult.S",
];
const SPOTS = ["p", "g", "b", "y", "v", "r", "Y"];
// 숫자 6자리(2026-10-09 사용자: "영문으로 하면 안 돼, 던전 모험처럼 숫자 6자리"). 아이가 말로 불러 주고 숫자판으로 넣기 쉽게.
// 모습 18 × 무늬 7 × 통통 6 × 꼬질 2 = 1,512가지 × 확인값 661 = 999,432 < 1,000,000. 아무 숫자나 넣으면 약 0.15%만 통과.
const COMBOS = VISIT_KEYS.length * SPOTS.length * 6 * 2, CHECK = 661;
export const VISIT_HOURS = 24;
export const VISIT_MAX = 2;
const check = (n) => { let h = Math.imul(n + 7919, 2654435761) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15; return (h >>> 0) % CHECK; }; // XOR 결과는 부호 있는 정수라 >>> 0 으로 양수로
// look: creature.js lookOf 결과
export function visitCode(key, look = {}) {
  const ki = VISIT_KEYS.indexOf(key); if (ki < 0) return null;
  const si = Math.max(0, SPOTS.indexOf(look.spot || "p"));
  const ci = Math.max(0, Math.min(5, Math.round(((look.chub || 1) - 1) / 0.05)));
  const payload = ((ki * SPOTS.length + si) * 6 + ci) * 2 + (look.messy ? 1 : 0);
  return String(payload * CHECK + check(payload)).padStart(6, "0");
}
export const normVisit = (c) => { const s = String(c || "").replace(/[\s-]/g, ""); return /^\d{6}$/.test(s) ? s : null; };
export function readVisit(code) {
  const s = normVisit(code); if (!s) return null;
  const n = Number(s), payload = Math.floor(n / CHECK);
  if (payload >= COMBOS || check(payload) !== n % CHECK) return null; // 숫자를 잘못 넣음
  let x = payload; const messy = !!(x % 2); x = Math.floor(x / 2); const ci = x % 6; x = Math.floor(x / 6); const si = x % SPOTS.length; const ki = Math.floor(x / SPOTS.length);
  const spot = SPOTS[si];
  return { key: VISIT_KEYS[ki], look: { spot, chosen: true, spot2: spot === "Y" ? "y" : SPOTS[(SPOTS.indexOf(spot) + 2) % 6], chub: 1 + ci * 0.05, messy } };
}
export const showVisit = (c) => `${c.slice(0, 3)} ${c.slice(3)}`;
// 놀러 온 손님 목록 정리: 24시간 지난 손님은 집에 감. 같은 코드는 한 번만. 최대 2명(오래된 손님부터 집에 감)
export function addVisitor(list, code, now) {
  const s = normVisit(code), v = s && readVisit(s);
  if (!v) return { ok: false, reason: "bad" };
  const live = pruneVisitors(list, now);
  if (live.some((x) => x.code === s)) return { ok: false, reason: "here", list: live };
  live.push({ code: s, at: now });
  while (live.length > VISIT_MAX) live.shift();
  return { ok: true, list: live, visitor: { code: s, ...v } };
}
export const pruneVisitors = (list, now) => (Array.isArray(list) ? list : []).filter((x) => x && normVisit(x.code) && now - x.at < VISIT_HOURS * 3600_000 && x.at <= now + 600_000);
