// 알림 일정 예측. "지금부터 아무도 안 돌보면 언제 무슨 일이 생기나"를 계산해 알림 목록으로 만든다.
// 휴대폰이 이 목록을 알림 서버에 올리고, 서버는 시각이 되면 보내기만 한다.
// 규칙은 GDD 7-1절. 공정성 원칙(알림 없이 돌봄 실수가 생기지 않음)은 test/notify.test.mjs 가 지킨다.
import { advance } from "./sim.js?v=bf34df8-1791372957";
import { isBusyTime } from "./daytime.js?v=bf34df8-1791372957";
import { DEFAULT_SETTINGS } from "./rules.js?v=bf34df8-1791372957";
import { josa } from "./josa.js?v=bf34df8-1791372957";

const I = (n) => josa(n, "이", "가"); // 주격
const EUL = (n) => josa(n, "을", "를"); // 목적격

const MIN = 60000;
export const MERGE_WINDOW_MS = 15 * MIN;
export const SAME_KIND_GAP_MS = 60 * MIN;

// 우선순위 순서(앞이 더 급함). urgent는 최소 간격·바쁜 시간 거르기를 무시한다.
export const KINDS = {
  ended: { urgent: true, text: (n, e) => (e.how === "journey" ? `${I(n)} 여행을 떠났어요. 편지를 남겼어요` : e.how === "runaway" ? `${I(n)} 삐져서 떠나 버렸어요. 편지를 남겼어요` : `${I(n)} 하늘의 별이 됐어요`) },
  danger: { urgent: true, text: (n) => `${I(n)} 많이 아파요. 이대로면 떠나 버릴지도 몰라요` },
  cryHunger: { urgent: true, text: (n) => `${I(n)} 배고파서 울고 있어요. 1시간 안에 와 주세요` },
  cryMood: { urgent: true, text: (n) => `${I(n)} 심심해서 울고 있어요. 1시간 안에 와 주세요` },
  sick: { urgent: true, text: (n) => `${I(n)} 아파요. 약이 필요해요` },
  light: { urgent: true, text: (n) => `${I(n)} 잠들었어요. 불을 꺼 주세요` },
  hungry: { urgent: false, text: (n) => `${I(n)} 배고파요` },
  bored: { urgent: false, text: (n) => `${I(n)} 놀아 달래요` },
  poop: { urgent: false, text: (n) => `${I(n)} 똥을 쌌어요. 톡 눌러 치워 주세요` },
  dirty: { urgent: false, text: (n) => `${I(n)} 꼬질꼬질해요. 씻겨 주세요` },
  farewell: { urgent: true, text: (n, e) => (e.how === "classic" ? `${I(n)} 많이 늙었어요. 곁에 있어 주세요` : `${I(n)} 내일 여행을 떠난대요. 많이 놀아 주세요`) },
  napEnd: { urgent: false, good: true, text: (n) => `${I(n)} 낮잠에서 깼어요. 기운이 났대요` },
  hatch: { urgent: false, good: true, text: (n) => `알이 깨어났어요! ${EUL(n)} 만나러 오세요` },
  evolve: { urgent: false, good: true, text: (n, e) => `${I(n)} ${I(STAGE_KO[e.stage] || "다음 모습")} 됐어요!` },
};
const ORDER = Object.keys(KINDS);
const STAGE_KO = { baby: "아기", child: "어린이", teen: "청소년", adult: "어른" };
const NEED_KINDS = new Set(["danger", "cryHunger", "cryMood", "sick", "light", "hungry", "bored", "poop", "dirty"]);

// 시뮬레이션 사건 → 알림 종류
function kindsOf(e) {
  switch (e.type) {
    case "crying": return [e.what === "hunger" ? "cryHunger" : "cryMood"];
    case "hungry": return ["hungry"];
    case "bored": return ["bored"];
    case "poop": return e.count === 2 ? ["poop"] : [];
    case "dirty": return ["dirty"];
    case "sick": return ["sick"];
    case "sleep": return e.lightOn ? ["light"] : [];
    case "hatch": return ["hatch"];
    case "nap-end": return e.woke ? [] : ["napEnd"]; // 직접 깨운 건 알림 없음
    case "ended": return ["ended"];
    case "danger": return ["danger"];
    case "farewellSoon": return ["farewell"];
    case "evolve": return ["evolve"];
    case "wake": {
      // 잠든 동안 생겨서 알림을 못 보낸 일은 깨는 순간 다시 알린다
      const p = e.pending, k = [];
      if (p.health <= 0) k.push("danger");
      if (p.hunger <= 0) k.push("cryHunger");
      if (p.mood <= 0) k.push("cryMood");
      if (p.sick) k.push("sick");
      if (p.hunger > 0 && p.hunger <= 20) k.push("hungry");
      if (p.poops >= 2) k.push("poop");
      return k;
    }
    default: return [];
  }
}

// 사건 목록 → 알림 목록 (잠 거르기, 바쁜 시간 거르기, 같은 종류 최소 간격, 15분 묶기)
export function eventsToNotifications(events, { asleepAtStart = false, settings = DEFAULT_SETTINGS, name = "" } = {}) {
  if (settings.notify && settings.notify.enabled === false) return [];
  const who = name || "펫";
  let asleep = asleepAtStart;
  const lastByKind = {};
  const groups = [];
  for (const e of events) {
    if (e.type === "sleep") asleep = true;
    if (e.type === "wake") asleep = false;
    let kinds = kindsOf(e);
    if (!kinds.length) continue;
    if (asleep && e.type !== "sleep" && e.type !== "ended") continue; // 자는 동안엔 안 보냄(불 끄기 알림만 잠드는 순간, 떠남은 예외)
    const busyOnlyUrgent = settings.notify?.busyOnlyUrgent && isBusyTime(e.t, settings);
    kinds = kinds.filter((k) => {
      const K = KINDS[k];
      if (busyOnlyUrgent && !K.urgent) return false;
      if (!K.urgent && lastByKind[k] !== undefined && e.t - lastByKind[k] < SAME_KIND_GAP_MS) return false;
      return true;
    });
    if (!kinds.length) continue;
    for (const k of kinds) lastByKind[k] = e.t;
    const g = groups[groups.length - 1];
    if (g && e.t - g.at <= MERGE_WINDOW_MS) {
      for (const k of kinds) if (!g.kinds.includes(k)) { g.kinds.push(k); g.src[k] = e; }
    } else {
      const src = {}; for (const k of kinds) src[k] = e;
      groups.push({ at: e.t, kinds: [...kinds], src });
    }
  }
  return groups.map((g) => {
    const kinds = [...g.kinds].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    return {
      at: g.at,
      kinds,
      urgent: kinds.some((k) => KINDS[k].urgent),
      title: name || "알모찌",
      body: kinds.map((k) => KINDS[k].text(who, g.src[k])).join(" · "),
      tag: "pocket-pet",
      badge: kinds.filter((k) => NEED_KINDS.has(k)).length,
    };
  });
}

// 지금 상태에서 앞으로 horizon 동안의 알림을 예측한다(원래 펫은 건드리지 않는다).
export function predictNotifications(pet, now, settings = DEFAULT_SETTINGS, { horizonMs = 48 * 3600 * 1000 } = {}) {
  const clone = structuredClone(pet);
  advance(clone, now, settings); // 밀린 계산부터
  const asleepAtStart = clone.asleep;
  // 이미 잠들었는데 불이 켜져 있으면(잠드는 순간이 지나 버림) 지금 바로 불 끄기 알림을 보낸다
  const pending = asleepAtStart && clone.lightOn && !clone.lightMistakeTonight && clone.stage !== "egg"
    ? [{ t: now, type: "sleep", lightOn: true, late: true }] : [];
  const events = [...pending, ...advance(clone, now + horizonMs, settings)];
  const notes = eventsToNotifications(events, { asleepAtStart, settings, name: pet.name });
  return { notes, events };
}
