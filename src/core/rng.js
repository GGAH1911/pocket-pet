// 시드 난수(mulberry32). 상태는 숫자 하나라 저장에 그대로 넣는다.
// 같은 시드 → 같은 똥 타이밍·같은 병 → 시험 재현, 미래 알림 일정 예측이 가능해진다.
export function nextRandom(state) {
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomInt(state, min, max) {
  return min + Math.floor(nextRandom(state) * (max - min + 1));
}
