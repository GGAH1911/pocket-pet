// 밸런스 수치표. GDD(docs/gdd.md) 3·5·6·7절과 1:1로 맞춘다.
// 숫자를 바꾸면 test/balance.test.mjs 가 어떤 결과가 달라졌는지 알려준다.
// 단위: "게임 시간"(보통 속도 기준). 실제 시간 = 게임 시간 / 속도.

export const SPEEDS = { slow: 0.5, normal: 1, fast: 3 };

export const PER_HOUR_AWAKE = {
  hunger: -10,
  mood: -8,
  energy: -4,
};
export const PER_HOUR_ASLEEP = {
  hunger: -1, // 잠은 실제 시계 기준이라 속도를 곱하지 않는다
  energy: +15,
};
export const MOOD_PER_POOP_PER_HOUR = -2;
export const HEALTH_PER_HOUR = {
  starving: -5, // 배부름 0
  perPoop: -1,
  sick: -3,
  recover: +2, // 깨어 있음: 안 아프고, 똥 없고, 배부름·기분 20 이상일 때
  recoverAsleep: +1, // 잠: 안 아프면
};
export const BUSY_FACTOR = 0.5; // 바쁜 시간에는 수치가 절반 속도로 준다

export const POOP = { minGap: 180, maxGap: 300, max: 4 }; // 게임 분
// 깨끗함: 깨어 있으면 조금씩, 바닥에 똥이 있으면 더 빨리, 놀면 조금 더러워진다. 씻기(목욕)로 100
export const CLEAN = { perHourAwake: -1, perPoopPerHour: -4, playCost: 5 };
export const SICK = { healthBelow: 40, chancePerHour: 0.1, lowHealthNeedsTwo: 20 };
export const SNACK_BINGE = { count: 4, withinMin: 60, healthCost: 15 };
export const NAP_MIN = 60; // 게임 분
export const NAP_ENERGY_PER_HOUR = 60; // 낮잠 1번(게임 1시간)에 기운 +60

export const ACTIONS = {
  meal: { hunger: +30, weight: +1, refuseAt: 90 },
  snack: { mood: +15, hunger: +5, weight: +2 },
  playWin: { mood: +25, energy: -5, weight: -1 },
  playLose: { mood: +10, energy: -5 },
  playMinEnergy: 10,
  medicine: { health: +30, moodIfNotSick: -10 },
};

// 단계 길이(게임 분)
export const STAGE_MIN = { egg: 10, baby: 120, child: 1440, teen: 2880 };
// 끝 방식(GDD 8절). 단위: 게임 분
export const ENDING = {
  journeyAdultMin: 7 * 1440, // 여행: 어른 7일 뒤 떠남
  classicLifeMin: [10 * 1440, 16 * 1440], // 원작: 어른 10~16일 사이 별이 됨
  neglectMin: 12 * 60, // 건강 0인 채로 12시간이면(여행: 삐져서 떠남, 원작: 별이 됨, 계속 살기: 앓아누움)
  warnBeforeMin: 1440, // 하루 전 이별 예고
  switchGraceMin: 1440, // 끝 방식을 바꾸면 적어도 하루는 더 함께
};
// 숨은 어른: 평생 돌봄 실수 0 + 쓰다듬기 30번 이상
export const SECRET = { maxMistakes: 0, minPats: 30 };

export const BRANCH = {
  childGoodMaxMistakes: 1, // 어린이 기간 실수 0~1 → 청소년 좋음
  teenFreeMaxMistakes: 3, // 청소년 보통에서 실수 0~3 → C, 4+ → D
};

// 돌봄 실수 판정
export const MISTAKE = {
  zeroGraceMin: 60, // 배부름·기분 0인 채로 게임 60분 (깨어 있는 시간만 셈)
  lightGraceRealMin: 30, // 잠든 뒤 불 켜진 채 실제 30분
  sickGraceMin: 180, // 아픈 채로 게임 180분 (깨어 있는 시간만 셈)
  lightMoodCost: 10,
};

// 알림 발생 기준
export const CALL = { hungryAt: 20, boredAt: 20, poopCount: 2, dirtyAt: 20 };

export const DEFAULT_SETTINGS = {
  sleep: { start: "23:00", end: "07:00" },
  busy: { enabled: false, start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] },
  endMode: "journey", // forever | journey | classic
  sound: false,
  notify: { enabled: true, busyOnlyUrgent: false },
};
