// 게임 규칙 엔진. 화면·브라우저를 모르고, 시각(ms)과 설정을 받아 펫 상태를 바꾼다.
// - 실제 시간 1분마다 한 번 계산(tick). 켜두고 1시간 = 꺼두고 1시간이 같은 결과.
// - 깨어 있는 동안의 변화는 속도 배율(게임 분)을 곱하고, 잠·바쁜 시간은 실제 시계를 따른다.
// - 무슨 일이 생겼는지(events)를 돌려준다 → "자리를 비운 동안" 요약과 알림 예측에 쓴다.
import {
  SPEEDS, PER_HOUR_AWAKE, PER_HOUR_ASLEEP, MOOD_PER_POOP_PER_HOUR, HEALTH_PER_HOUR, BUSY_FACTOR,
  POOP, CLEAN, SICK, SNACK_BINGE, NAP_MIN, NAP_ENERGY_PER_HOUR, NAP_LIGHT_BELOW, ACTIONS, STAGE_MIN, BRANCH, MISTAKE, CALL, DEFAULT_SETTINGS, ENDING, SECRET,
} from "./rules.js?v=4036598-1791263909";
import { clampStat } from "./state.js?v=4036598-1791263909";
import { nextRandom, randomInt } from "./rng.js?v=4036598-1791263909";
import { isSleepTime, isBusyTime } from "./daytime.js?v=4036598-1791263909";

const MINUTE = 60000;
const NEXT_STAGE = { egg: "baby", baby: "child", child: "teen", teen: "adult" };

function addMistake(pet, ts, cause, events) {
  pet.mistakes.total++;
  pet.mistakes.stage++;
  events.push({ t: ts, type: "mistake", cause });
}

function clampAll(pet) {
  for (const k of Object.keys(pet.stats)) pet.stats[k] = clampStat(pet.stats[k]);
}

function growUp(pet, ts, events) {
  const limit = STAGE_MIN[pet.stage];
  if (limit === undefined || pet.stageMin < limit) return;
  const from = pet.stage;
  const to = NEXT_STAGE[from];
  let branch = null;
  if (from === "child") {
    branch = pet.mistakes.stage <= BRANCH.childGoodMaxMistakes ? "good" : "normal";
  } else if (from === "teen") {
    if (pet.mistakes.total <= SECRET.maxMistakes && (pet.pats || 0) >= SECRET.minPats) branch = "S"; // 숨은 어른
    else if (pet.branch === "good") branch = pet.counts.plays >= pet.counts.snacks ? "A" : "B";
    else branch = pet.mistakes.stage <= BRANCH.teenFreeMaxMistakes ? "C" : "D";
    pet.lifespan = randomInt(pet, ENDING.classicLifeMin[0], ENDING.classicLifeMin[1]);
  }
  pet.stage = to;
  pet.branch = branch;
  pet.stageMin -= limit;
  pet.mistakes.stage = 0;
  pet.counts = { plays: 0, snacks: 0 };
  events.push({ t: ts, type: from === "egg" ? "hatch" : "evolve", stage: to, branch });
}

// 어른이 떠나는 시점(게임 분, 어른 단계 기준). 끝 방식을 도중에 바꾸면 적어도 하루는 더 함께한다.
export function departureAt(pet, mode) {
  if (pet.stage !== "adult") return null;
  let at = mode === "journey" ? ENDING.journeyAdultMin : mode === "classic" ? pet.lifespan || ENDING.classicLifeMin[0] : null;
  if (at === null) return null;
  const sw = pet.endSwitch;
  if (sw && sw.mode === mode && sw.stage === "adult") at = Math.max(at, sw.at + ENDING.switchGraceMin);
  return at;
}

function endPet(pet, ts, type, events) {
  pet.ended = { type, at: ts };
  events.push({ t: ts, type: "ended", how: type });
}

function checkEnding(pet, ts, settings, events, dGame) {
  const mode = settings.endMode || "journey";
  const s = pet.stats;
  // 방치: 건강 0
  if (s.health <= 0) {
    if (pet.zeroHealthMin === 0) events.push({ t: ts, type: "danger" });
    pet.zeroHealthMin += dGame;
    if (mode === "forever") {
      if (!pet.sick) { pet.sick = true; events.push({ t: ts, type: "sick" }); }
      pet.medsNeeded = Math.max(pet.medsNeeded, 2); // 앓아누움: 약 두 번
    } else if (pet.zeroHealthMin >= ENDING.neglectMin) {
      endPet(pet, ts, mode === "classic" ? "star" : "runaway", events);
      return;
    }
  } else pet.zeroHealthMin = 0;
  // 수명·여행
  const dep = departureAt(pet, mode);
  if (dep !== null) {
    if (!pet.farewellWarned && pet.stageMin >= dep - ENDING.warnBeforeMin) { pet.farewellWarned = true; events.push({ t: ts, type: "farewellSoon", how: mode }); }
    if (pet.stageMin >= dep) endPet(pet, ts, mode === "classic" ? "star" : "journey", events);
  }
}

// 실제 1분(ts부터 ts+1분까지)을 계산한다.
export function tickMinute(pet, ts, settings = DEFAULT_SETTINGS, events = []) {
  const dGame = SPEEDS[pet.speed]; // 이 1분이 게임 시간으로 몇 분인지
  pet.ageMin += dGame;
  pet.stageMin += dGame;

  if (pet.stage === "egg") {
    growUp(pet, ts, events);
    return events;
  }

  const s = pet.stats;
  const before = { hunger: s.hunger, mood: s.mood, clean: s.clean };

  // 잠: 실제 시계의 취침·기상 시각을 따른다
  const sleepNow = isSleepTime(ts, settings);
  if (sleepNow && !pet.asleep) {
    pet.asleep = true;
    pet.sleptAt = ts;
    pet.napLeft = 0; pet.napManual = false;
    pet.lightMistakeTonight = false;
    events.push({ t: ts, type: "sleep", lightOn: pet.lightOn });
  } else if (!sleepNow && pet.asleep) {
    pet.asleep = false;
    pet.lightOn = true;
    events.push({
      t: ts, type: "wake",
      pending: { hunger: s.hunger, mood: s.mood, poops: pet.poops, sick: pet.sick, health: s.health },
    });
  }

  if (pet.asleep) {
    s.hunger += PER_HOUR_ASLEEP.hunger / 60;
    s.energy += PER_HOUR_ASLEEP.energy / 60;
    if (!pet.sick) s.health += HEALTH_PER_HOUR.recoverAsleep / 60;
    if (pet.lightOn && !pet.lightMistakeTonight && ts - pet.sleptAt > MISTAKE.lightGraceRealMin * MINUTE) {
      pet.lightMistakeTonight = true;
      s.mood -= MISTAKE.lightMoodCost;
      addMistake(pet, ts, "light", events);
    }
  } else {
    const f = dGame * (isBusyTime(ts, settings) ? BUSY_FACTOR : 1); // 수치 변화에 쓰는 게임 분
    s.hunger += (PER_HOUR_AWAKE.hunger / 60) * f;
    if (pet.napLeft > 0) {
      s.energy += (NAP_ENERGY_PER_HOUR / 60) * dGame;
      pet.napLeft -= dGame;
      if (pet.napLeft <= 0) {
        pet.napLeft = 0;
        if (pet.napManual) { pet.lightOn = true; pet.napManual = false; } // 불 끄고 재운 낮잠: 깨면 불을 켬
        events.push({ t: ts, type: "nap-end" });
      }
    } else {
      s.mood += ((PER_HOUR_AWAKE.mood + MOOD_PER_POOP_PER_HOUR * pet.poops) / 60) * f;
      s.energy += (PER_HOUR_AWAKE.energy / 60) * f;
      if (s.energy <= 0) { pet.napLeft = NAP_MIN; events.push({ t: ts, type: "nap" }); }
    }

    // 똥
    pet.poopTimer += f;
    if (pet.poopTimer >= pet.poopGap) {
      pet.poopTimer = 0;
      pet.poopGap = randomInt(pet, POOP.minGap, POOP.maxGap);
      if (pet.poops < POOP.max) {
        pet.poops++;
        events.push({ t: ts, type: "poop", count: pet.poops });
      }
    }
    s.clean += ((CLEAN.perHourAwake + CLEAN.perPoopPerHour * pet.poops) / 60) * f;

    // 건강
    let dh = HEALTH_PER_HOUR.perPoop * pet.poops;
    if (s.hunger <= 0) dh += HEALTH_PER_HOUR.starving;
    if (pet.sick) dh += HEALTH_PER_HOUR.sick;
    if (!pet.sick && pet.poops === 0 && s.hunger >= 20 && s.mood >= 20 && s.clean >= 20) dh += HEALTH_PER_HOUR.recover;
    s.health += (dh / 60) * f;

    // 아픔
    if (!pet.sick && s.health < SICK.healthBelow) {
      const p = 1 - Math.pow(1 - SICK.chancePerHour, f / 60);
      if (nextRandom(pet) < p) {
        pet.sick = true;
        pet.medsNeeded = s.health < SICK.lowHealthNeedsTwo ? 2 : 1;
        events.push({ t: ts, type: "sick" });
      }
    }
  }
  clampAll(pet);

  // 알림용 문턱 넘김
  if (before.hunger > CALL.hungryAt && s.hunger <= CALL.hungryAt) events.push({ t: ts, type: "hungry" });
  if (before.mood > CALL.boredAt && s.mood <= CALL.boredAt) events.push({ t: ts, type: "bored" });
  if (before.clean > CALL.dirtyAt && s.clean <= CALL.dirtyAt) events.push({ t: ts, type: "dirty" });
  if (before.hunger > 0 && s.hunger <= 0) events.push({ t: ts, type: "crying", what: "hunger" });
  if (before.mood > 0 && s.mood <= 0) events.push({ t: ts, type: "crying", what: "mood" });

  // 돌봄 실수 (깨어 있는 게임 시간만 센다: 잠든 동안엔 알림이 안 가므로)
  const t = pet.timers, fl = pet.flags;
  const awake = !pet.asleep;
  if (s.hunger <= 0) { if (awake) t.hungerZero += dGame; } else { t.hungerZero = 0; fl.hungerMistake = false; }
  if (s.mood <= 0) { if (awake) t.moodZero += dGame; } else { t.moodZero = 0; fl.moodMistake = false; }
  if (pet.sick) { if (awake) t.sick += dGame; } else { t.sick = 0; fl.sickMistake = false; }
  if (t.hungerZero > MISTAKE.zeroGraceMin && !fl.hungerMistake) { fl.hungerMistake = true; addMistake(pet, ts, "hunger", events); }
  if (t.moodZero > MISTAKE.zeroGraceMin && !fl.moodMistake) { fl.moodMistake = true; addMistake(pet, ts, "mood", events); }
  if (t.sick > MISTAKE.sickGraceMin && !fl.sickMistake) { fl.sickMistake = true; addMistake(pet, ts, "sick", events); }

  growUp(pet, ts, events);
  if (!pet.ended) checkEnding(pet, ts, settings, events, dGame);
  return events;
}

// now까지 밀린 시간을 모두 계산한다. 시계가 뒤로 가면 아무것도 안 한다(두 번 세지 않음).
export function advance(pet, now, settings = DEFAULT_SETTINGS, events = []) {
  while (pet.lastTickAt + MINUTE <= now && !pet.ended) {
    tickMinute(pet, pet.lastTickAt, settings, events);
    pet.lastTickAt += MINUTE;
  }
  return events;
}

// ---------- 돌봄 행동 ----------
// 모두 먼저 now까지 계산한 뒤 적용한다. 결과: { ok, reason?, events }

// 낮잠 중에 돌봄 행동을 하면 먼저 깨운다(불 켜짐). 밤잠은 깨우지 않는다(begin에서 거절).
export function wakeFromNap(pet, now, events = []) {
  if (pet.asleep || pet.napLeft <= 0) return false;
  pet.napLeft = 0; pet.napManual = false; pet.lightOn = true;
  events.push({ t: now, type: "nap-end", woke: true, by: "action" });
  return true;
}

function begin(pet, now, settings) {
  const events = advance(pet, now, settings);
  if (pet.ended) return { ok: false, reason: "ended", events };
  if (pet.stage === "egg") return { ok: false, reason: "egg", events };
  if (pet.asleep) return { ok: false, reason: "asleep", events };
  const woke = wakeFromNap(pet, now, events);
  return { ok: true, events, woke };
}

export function feed(pet, kind, now, settings = DEFAULT_SETTINGS) {
  const r = begin(pet, now, settings);
  if (!r.ok) return r;
  const s = pet.stats;
  if (kind === "meal") {
    if (s.hunger >= ACTIONS.meal.refuseAt) return { ok: false, reason: "full", events: r.events };
    s.hunger += ACTIONS.meal.hunger;
    pet.weight += ACTIONS.meal.weight;
  } else if (kind === "snack") {
    s.mood += ACTIONS.snack.mood;
    s.hunger += ACTIONS.snack.hunger;
    pet.weight += ACTIONS.snack.weight;
    pet.counts.snacks++;
    pet.snackTimes = [...pet.snackTimes, pet.ageMin].filter((m) => pet.ageMin - m < SNACK_BINGE.withinMin);
    if (pet.snackTimes.length >= SNACK_BINGE.count) {
      s.health -= SNACK_BINGE.healthCost;
      pet.snackTimes = [];
      if (!pet.sick) {
        pet.sick = true;
        pet.medsNeeded = s.health < SICK.lowHealthNeedsTwo ? 2 : 1;
        r.events.push({ t: now, type: "sick", cause: "binge" });
      }
    }
  } else {
    throw new Error(`feed: 모르는 음식 ${kind}`);
  }
  clampAll(pet);
  return r;
}

export function play(pet, now, settings = DEFAULT_SETTINGS, { win = true } = {}) {
  const r = begin(pet, now, settings);
  if (!r.ok) return r;
  if (pet.stats.energy < ACTIONS.playMinEnergy) return { ok: false, reason: "tired", events: r.events };
  const a = win ? ACTIONS.playWin : ACTIONS.playLose;
  pet.stats.mood += a.mood;
  pet.stats.energy += a.energy;
  pet.stats.clean -= CLEAN.playCost;
  if (a.weight) pet.weight = Math.max(5, pet.weight + a.weight);
  pet.napLeft = 0;
  pet.counts.plays++;
  clampAll(pet);
  return r;
}

// 산책: 기분 +30, 기운 -10, 배부름 -5, 깨끗함 -5(비·눈 오는 날 -15), 몸무게 -1. 놀아준 횟수로 센다.
export function walk(pet, now, settings = DEFAULT_SETTINGS, { wet = false } = {}) {
  const r = begin(pet, now, settings);
  if (!r.ok) return r;
  if (pet.stats.energy < ACTIONS.walkMinEnergy) return { ok: false, reason: "tired", events: r.events };
  const a = ACTIONS.walk;
  pet.stats.mood += a.mood;
  pet.stats.energy += a.energy;
  pet.stats.hunger += a.hunger;
  pet.stats.clean -= wet ? CLEAN.walkWetCost : CLEAN.walkCost;
  pet.weight = Math.max(5, pet.weight + a.weight);
  pet.counts.plays++;
  clampAll(pet);
  return r;
}

// 씻기(목욕): 깨끗함만 100. 바닥의 똥은 따로 톡 눌러 치운다.
export function wash(pet, now, settings = DEFAULT_SETTINGS) {
  const r = begin(pet, now, settings);
  if (!r.ok) return r;
  pet.stats.clean = 100;
  return r;
}

// 똥 하나 치우기(화면의 똥을 톡). 펫이 자고 있어도 바닥은 치울 수 있다.
export function cleanPoop(pet, now, settings = DEFAULT_SETTINGS) {
  const events = advance(pet, now, settings);
  if (pet.poops <= 0) return { ok: false, reason: "no-poop", events };
  pet.poops--;
  return { ok: true, events, left: pet.poops };
}

// 불은 잘 때도 켜고 끌 수 있다(그게 목적이므로).
// 낮(깨어 있을 때) 불을 끄면: 기운이 50 미만이면 바로 낮잠(깨면 불이 저절로 켜짐), 아니면 "아직 안 졸려요"(불만 꺼짐).
// 낮잠 중에 불을 켜면 깨어난다.
export function toggleLight(pet, now, settings = DEFAULT_SETTINGS) {
  const events = advance(pet, now, settings);
  if (pet.ended) return { ok: false, reason: "ended", events };
  if (pet.stage === "egg") return { ok: false, reason: "egg", events };
  pet.lightOn = !pet.lightOn;
  let napped = false, woke = false, notSleepy = false;
  if (!pet.asleep) {
    if (!pet.lightOn && pet.napLeft <= 0) {
      if (pet.stats.energy < NAP_LIGHT_BELOW) { pet.napLeft = NAP_MIN; pet.napManual = true; napped = true; events.push({ t: now, type: "nap", manual: true }); }
      else notSleepy = true;
    } else if (pet.lightOn && pet.napLeft > 0) { pet.napLeft = 0; pet.napManual = false; woke = true; events.push({ t: now, type: "nap-end", woke: true }); }
  }
  return { ok: true, events, lightOn: pet.lightOn, napped, woke, notSleepy };
}

export function giveMedicine(pet, now, settings = DEFAULT_SETTINGS) {
  const r = begin(pet, now, settings);
  if (!r.ok) return r;
  if (!pet.sick) {
    pet.stats.mood += ACTIONS.medicine.moodIfNotSick;
    clampAll(pet);
    return { ok: false, reason: "not-sick", events: r.events };
  }
  pet.stats.health += ACTIONS.medicine.health;
  pet.medsNeeded--;
  if (pet.medsNeeded <= 0) { pet.sick = false; pet.medsNeeded = 0; }
  clampAll(pet);
  return r;
}

// 쓰다듬기: 수치는 그대로, 횟수만 센다(숨은 어른 조건). 1분에 최대 3번까지만 센다.
export function patPet(pet, now, settings = DEFAULT_SETTINGS) {
  const events = advance(pet, now, settings);
  if (pet.ended || pet.stage === "egg") return { ok: false, events };
  const minute = Math.floor(now / MINUTE);
  if (pet.patMinute !== minute) { pet.patMinute = minute; pet.patInMinute = 0; }
  if (pet.patInMinute < 3) { pet.patInMinute++; pet.pats = (pet.pats || 0) + 1; }
  return { ok: true, events, pats: pet.pats };
}

// 끝 방식 바꾸기: 지금부터 적용(적어도 하루는 더 함께)
export function switchEndMode(pet, mode, now, settings) {
  advance(pet, now, settings);
  pet.endSwitch = { mode, stage: pet.stage, at: pet.stageMin };
  pet.farewellWarned = false;
}

// "계속 살기"에서 직접 마무리하고 새 알 받기
export function retirePet(pet, now, settings) {
  advance(pet, now, settings);
  if (!pet.ended) pet.ended = { type: "retired", at: now };
}
