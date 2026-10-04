// 실제 시계(현지 시각) 기준의 잠자는 시간·바쁜 시간 판정.
const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

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
