// 친구 마을(2026-10-09 사용자 결정 + 게임·감정선·아동 심리 자문): "함께 사는 건 여럿, 돌보는 건 하나".
// 부활권으로 옛 친구를 데려오거나 새 알을 받을 때, 지금 친구는 사라지지 않고 친구 마을로 이사 간다.
// 마을 친구는 시간이 멈춰 있다(배고파지지 않고, 알림도 없고, 삐지지도 않음). 하루 한 번 무료로 지금 친구와 교대할 수 있다.
const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

export const villageOf = (profile) => (Array.isArray(profile.village) ? profile.village : (profile.village = []));
export function moveToVillage(profile, pet, now) {
  if (!pet) return null;
  const p = { ...pet, ended: null, napLeft: 0, napManual: false };
  const v = { pet: p, movedAt: now };
  villageOf(profile).push(v);
  return v;
}
export const canSwapToday = (profile, now) => profile.villageSwapDay !== dayKey(now);
// 마을 친구 i를 데려오고, 지금 친구(있으면)는 마을로. 돌려줌: { ok, back(돌아온 펫), moved(이사 간 펫) }
export function swapWithVillage(profile, i, now) {
  const list = villageOf(profile), v = list[i];
  if (!v) return { ok: false, reason: "none" };
  if (!canSwapToday(profile, now)) return { ok: false, reason: "today" };
  const cur = profile.pet && !profile.pet.ended ? profile.pet : null;
  list.splice(i, 1);
  const back = v.pet;
  back.lastTickAt = Math.floor(now / 60000) * 60000; // 마을에 있던 동안은 시간이 멈춤
  back.ended = null;
  if (cur) moveToVillage(profile, cur, now);
  profile.pet = back;
  profile.villageSwapDay = dayKey(now);
  return { ok: true, back, moved: cur };
}
