// 받침에 따라 조사 고르기: josa("토리", "이", "가") → "토리가", josa("콩이", ...) → "콩이가", josa("별", ...) → "별이"
// 숫자로 끝나면 읽는 소리로: 60 → 육십(받침), 2 → 이(없음). "하트 보석 60을"(전에는 "60를")
const DIGIT_B = { 0: true, 1: true, 2: false, 3: true, 4: false, 5: false, 6: true, 7: true, 8: true, 9: false };
export function hasBatchim(word) {
  const w = String(word).trim().replace(/,/g, "");
  const m = w.match(/(\d+)$/);
  if (m) { const n = m[1].replace(/^0+(?=\d)/, ""); const last = n.replace(/0+$/, ""); return n === "0" ? true : last.length < n.length ? true : DIGIT_B[n.slice(-1)]; } // 십·백·천·만은 모두 받침
  const ch = w.slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false; // 한글이 아니면 받침 없음으로 본다
  return code % 28 !== 0;
}
export function josa(word, withB, withoutB) {
  return `${word}${hasBatchim(word) ? withB : withoutB}`;
}
