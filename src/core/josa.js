// 받침에 따라 조사 고르기: josa("토리", "이", "가") → "토리가", josa("콩이", ...) → "콩이가", josa("별", ...) → "별이"
export function hasBatchim(word) {
  const ch = String(word).trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false; // 한글이 아니면 받침 없음으로 본다
  return code % 28 !== 0;
}
export function josa(word, withB, withoutB) {
  return `${word}${hasBatchim(word) ? withB : withoutB}`;
}
