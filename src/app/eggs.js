// 숨은 재미(이스터 에그). 화면과 분리된 판정만: 연속 터치, 특별한 날, 11:11, 찾은 기록.
// 게임 수치는 바꾸지 않는다.

export const EGGS = [
  { id: "butt", name: "엉덩이춤", desc: "기분이 아주 좋으면 가끔 엉덩이를 씰룩씰룩 흔들어요", hint: "기분이 아주 좋을 때 가만히 지켜보면…" },
  { id: "tickle", name: "간지럼", desc: "아주 빠르게 쓰다듬으면 꺄르르 데굴데굴", hint: "쓰다듬기를 아주 빠르게 하면?" },
  { id: "star", name: "별똥별", desc: "창문을 톡톡톡톡톡 두드리면 별똥별이 지나가요", hint: "창문을 자꾸 두드리면…" },
  { id: "frame", name: "사진 속 친구", desc: "사진 액자를 누르면 그 친구 소식을 궁금해해요", hint: "벽에 걸린 걸 눌러 보세요" },
  { id: "wish1111", name: "11:11", desc: "11시 11분, 22시 22분은 소원 시간", hint: "시계 숫자가 나란히 설 때" },
  { id: "special", name: "특별한 날", desc: "새해·밸런타인·핼러윈·크리스마스엔 꾸미고 기다려요", hint: "달력에 동그라미 친 날" },
  { id: "eggPeek", name: "알의 인사", desc: "알을 톡톡 두드리면 안에서 인사해요", hint: "깨어나기 전에도 대화할 수 있을까?" },
  { id: "maker", name: "만든 사람", desc: "도감의 이름을 다섯 번 부르면 편지가 있어요", hint: "도감의 이름을 불러 보세요" },
];

// 처음 찾으면 true
export function findEgg(profile, id, now = Date.now()) {
  profile.eggs = profile.eggs || {};
  if (profile.eggs[id]) return false;
  profile.eggs[id] = now;
  return true;
}
export const foundCount = (profile) => EGGS.filter((e) => profile.eggs && profile.eggs[e.id]).length;

// 연속 터치: windowMs 안에 n번이면 true(그리고 초기화)
export function createStreak(n, windowMs) {
  let taps = [];
  return {
    tap(now) {
      taps = taps.filter((t) => now - t <= windowMs);
      taps.push(now);
      if (taps.length >= n) { taps = []; return true; }
      return false;
    },
    reset() { taps = []; },
  };
}

// 특별한 날(현지 날짜): 모자 종류
export function specialDay(date) {
  const m = date.getMonth() + 1, d = date.getDate();
  if (m === 1 && d === 1) return "newyear";
  if (m === 2 && d === 14) return "valentine";
  if (m === 10 && d === 31) return "halloween";
  if (m === 12 && (d === 24 || d === 25)) return "xmas";
  return null;
}
export const SPECIAL_KO = { newyear: "새해 복 많이 받으세요!", valentine: "해피 밸런타인!", halloween: "해피 핼러윈!", xmas: "메리 크리스마스!" };
export const HAT_OF = { newyear: "partyHat", valentine: "heartClip", halloween: "pumpkinHat", xmas: "santaHat" };

// 11:11 / 22:22 (분 단위 키: 같은 순간에 한 번만)
export function wishTime(date) {
  const h = date.getHours(), mi = date.getMinutes();
  return (h === 11 && mi === 11) || (h === 22 && mi === 22) ? `${date.toDateString()} ${h}:${mi}` : null;
}

export const MAKER_LETTER = "이 작은 친구는 딱 한 사람을 위해 만들어졌어요.\n바쁜 하루 사이사이 들여다보며 잠깐이라도 웃을 수 있기를.\n밥 주고, 놀아 주고, 재워 주는 그 마음이 제일 귀여워요.\n- 만든 사람이";
