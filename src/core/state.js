// 펫 상태의 단일 정의. 화면·저장 코드는 이 모양만 믿어요.
// 규칙(수치 감소, 성장, 진화)은 M2 프로토타입에서 sim.js로 추가해요.

export const SAVE_VERSION = 1;

export const STAT_KEYS = ["hunger", "mood", "clean", "energy", "health"];
export const STAT_MIN = 0;
export const STAT_MAX = 100;

export function clampStat(v) {
  return Math.min(STAT_MAX, Math.max(STAT_MIN, v));
}

export function createPet(now) {
  if (!Number.isFinite(now)) throw new Error("createPet: now(시각)가 필요해요");
  return {
    version: SAVE_VERSION,
    bornAt: now,
    lastTickAt: now,
    stage: "egg",
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, STAT_MAX])),
    careMistakes: 0,
  };
}
