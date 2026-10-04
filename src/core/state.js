// 펫 상태의 단일 정의. 화면·저장 코드는 이 모양만 믿어요.
import { SPEEDS, POOP } from "./rules.js?v=fb4c507-1791115840";

export const SAVE_VERSION = 2;

export const STAT_KEYS = ["hunger", "mood", "clean", "energy", "health"];
export const STAT_MIN = 0;
export const STAT_MAX = 100;
export const THEMES = ["animal", "fantasy"];

export function clampStat(v) {
  return Math.min(STAT_MAX, Math.max(STAT_MIN, v));
}

export function createPet({ now, seed = 1, theme = "animal", name = "", speed = "normal" } = {}) {
  if (!Number.isFinite(now)) throw new Error("createPet: now(시각)가 필요해요");
  if (!(speed in SPEEDS)) throw new Error(`createPet: 모르는 속도 ${speed}`);
  if (!THEMES.includes(theme)) throw new Error(`createPet: 모르는 테마 ${theme}`);
  const lastTickAt = Math.floor(now / 60000) * 60000; // 분 단위로 맞춰 계산
  return {
    version: SAVE_VERSION,
    theme,
    name,
    speed,
    rng: seed >>> 0,
    bornAt: now,
    lastTickAt,
    ageMin: 0, // 게임 분
    stage: "egg", // egg | baby | child | teen | adult
    branch: null, // teen: good|normal, adult: A|B|C|D
    stageMin: 0,
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, STAT_MAX])),
    weight: 10,
    poops: 0,
    poopTimer: 0, // 깨어 있는 게임 분
    poopGap: Math.round((POOP.minGap + POOP.maxGap) / 2),
    lightOn: true,
    asleep: false,
    sleptAt: null,
    lightMistakeTonight: false,
    napLeft: 0, // 게임 분
    sick: false,
    medsNeeded: 0,
    timers: { hungerZero: 0, moodZero: 0, sick: 0 }, // 깨어 있는 게임 분
    flags: { hungerMistake: false, moodMistake: false, sickMistake: false },
    mistakes: { total: 0, stage: 0 },
    counts: { plays: 0, snacks: 0 }, // 이번 단계
    snackTimes: [], // 최근 간식 시각(게임 분)
  };
}
