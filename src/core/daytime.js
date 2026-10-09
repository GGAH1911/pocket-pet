// 실제 시계(현지 시각) 기준의 잠자는 시간·바쁜 시간 판정.
const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

// 잠자는 시간 직접 설정(2026-10-08 사용자 요청, 2026-10-09 12시간까지): 30분 단위, 자는 시각 19:00~02:00, 깨는 시각 04:00~11:00, 6~12시간
export const SLEEP_START_OPTS = Array.from({ length: 15 }, (_, i) => { const m = (19 * 60 + i * 30) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; });
export const SLEEP_END_OPTS = Array.from({ length: 15 }, (_, i) => { const m = 4 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; });
const hm2m = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const sleepLength = (start, end) => (hm2m(end) - hm2m(start) + 1440) % 1440; // 분
export const sleepOk = (start, end) => SLEEP_START_OPTS.includes(start) && SLEEP_END_OPTS.includes(end) && sleepLength(start, end) >= 360 && sleepLength(start, end) <= 720;
export function minuteOfDay(ts) {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

function inWindow(min, start, end) {
  const s = toMin(start), e = toMin(end);
  return s <= e ? min >= s && min < e : min >= s || min < e; // 자정을 넘는 구간
}

export function isSleepTime(ts, settings) {
  return inWindow(minuteOfDay(ts), settings.sleep.start, settings.sleep.end);
}

export function isBusyTime(ts, settings) {
  const b = settings.busy;
  if (!b || !b.enabled) return false;
  return b.days.includes(new Date(ts).getDay()) && inWindow(minuteOfDay(ts), b.start, b.end);
}
