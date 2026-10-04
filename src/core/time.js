// 시간은 항상 이 모듈을 통해서만 읽어요.
// 게임 규칙(core)은 Date.now()를 직접 부르지 않고 clock을 받아서 써요.
// 그래야 시험에서 "7일 지남"을 즉시 만들고, 개발용 시간 가속도 붙일 수 있어요.

export const realClock = {
  now: () => Date.now(),
};

// 시험·디버그용 가짜 시계: 원하는 만큼 시간을 앞으로 돌려요.
export function createFakeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => { t += ms; return t; },
    set: (ms) => { t = ms; return t; },
  };
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
