// 새 버전 알림 판단(순수 함수). 2026-10-09 사용자 요청: 내부 테스트는 플레이에서 업데이트가 안 보여 옛 버전에 머무는 일이 있었음(1.0.4에 머물러 결제 시험 실패).
// latest.json = { code, name, minCode, notes } — 플레이에 올린 '뒤' tools/set-latest.mjs로 갱신해 웹에 배포한다(올리기 전에 알리면 플레이에 아직 없음).
// 자문(capacitor-app-store): 플레이 In-App Updates는 같은 플레이 캐시를 써서 늦게 뜸 → 자체 latest.json이 더 확실. 강제는 minCode(치명적 수정)일 때만.
export const SNOOZE_MS = 12 * 3600 * 1000;
export function updateState(curCode, latest, snooze = null, now = Date.now()) {
  const cur = Number(curCode) || 0, code = Number(latest?.code) || 0, min = Number(latest?.minCode) || 0;
  if (!cur || !code || code <= cur) return { show: false, force: false };
  const force = min > cur;
  if (!force && snooze && Number(snooze.code) === code && now < Number(snooze.until)) return { show: false, force: false, snoozed: true };
  return { show: true, force };
}
// 웹: 배포할 때마다 바뀌는 version.txt와 지금 불러온 코드의 ?v= 를 비교(개발 서버처럼 v가 없으면 알리지 않음)
export const webOutdated = (loadedV, siteV) => !!loadedV && !!siteV && String(siteV).trim() !== String(loadedV).trim();
