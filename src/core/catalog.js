// 상품 목록(첫 출시분). 그림은 render/deco.js, 값과 규칙은 여기.
// slot: wall(벽지) floor(바닥) rug(러그) curtain(창문) furnL(왼쪽 가구) furnR(오른쪽 가구) hat(머리)
// price: { star } 또는 { gem }. 없으면 팔지 않음(기본·보상·꾸러미 전용).
// basic: 처음부터 가짐. source: 얻는 곳 설명(팔지 않는 것).

export const SLOTS = [
  { id: "wall", name: "벽지" },
  { id: "floor", name: "바닥" },
  { id: "rug", name: "러그" },
  { id: "curtain", name: "창문" },
  { id: "furnL", name: "왼쪽 가구" },
  { id: "furnR", name: "오른쪽 가구" },
  // 2026-10-09 사용자 요청 "가구 놓을 데가 더 있었으면"(디자인 자문 1단계): 한 화면 안 빈 곳에 칸 3개
  { id: "sill", name: "창가" },
  { id: "wallR", name: "벽걸이" },
  { id: "prop", name: "바닥 소품" },
  // 놀이방(2026-10-09 디자인 자문 2단계): 마을 친구·놀러 온 친구가 노는 방의 놀이 기구 칸 3개
  { id: "playL", name: "놀이방 왼쪽" },
  { id: "playM", name: "놀이방 가운데" },
  { id: "playR", name: "놀이방 오른쪽" },
  { id: "hat", name: "머리" },
];

export const ITEMS = [
  // 벽지
  { id: "wall_basic", slot: "wall", name: "살구 벽지", basic: true },
  { id: "wall_berry", slot: "wall", name: "딸기 벽지", price: { gem: 60 } },
  { id: "wall_cloud", slot: "wall", name: "구름 벽지", price: { star: 400 } },
  { id: "wall_night", slot: "wall", name: "별밤 벽지", price: { gem: 60 } },
  { id: "wall_leaf", slot: "wall", name: "나뭇잎 벽지", price: { star: 400 } },
  // 바닥
  { id: "floor_wood", slot: "floor", name: "나무 바닥", basic: true },
  { id: "floor_check", slot: "floor", name: "체크 타일", price: { star: 300 } },
  { id: "floor_carpet", slot: "floor", name: "푹신 카펫", price: { gem: 60 } },
  { id: "floor_grass", slot: "floor", name: "잔디 바닥", price: { star: 500 } },
  // 러그
  { id: "rug_pink", slot: "rug", name: "분홍 러그", basic: true },
  { id: "rug_star", slot: "rug", name: "별 러그", source: "도감 보상(어른 5종)" },
  { id: "rug_green", slot: "rug", name: "풀잎 러그", price: { star: 250 } },
  { id: "rug_purple", slot: "rug", name: "보랏빛 러그", price: { star: 250 } },
  { id: "rug_rainbow", slot: "rug", name: "무지개 러그", price: { gem: 90 } },
  // 창문 커튼
  { id: "curtain_pink", slot: "curtain", name: "분홍 커튼", price: { star: 350 } },
  { id: "curtain_lace", slot: "curtain", name: "레이스 커튼", price: { gem: 60 } },
  { id: "curtain_star", slot: "curtain", name: "별빛 커튼", price: { gem: 90 } },
  // 가구(왼쪽·오른쪽 자리)
  { id: "lamp", slot: "furnL", name: "달님 스탠드", price: { gem: 90 }, desc: "밤에 불을 끄면 은은하게 켜져요" },
  { id: "plant", slot: "furnL", name: "몬스테라 화분", price: { star: 600 }, desc: "잎이 살랑살랑" },
  { id: "shelf", slot: "furnL", name: "작은 책장", price: { star: 900 } },
  { id: "sofa", slot: "furnR", name: "폭신 소파", price: { star: 1200 }, desc: "가끔 올라가 쉬어요" },
  { id: "fishbowl", slot: "furnR", name: "금붕어 어항", price: { gem: 150 }, desc: "금붕어가 헤엄쳐요" },
  { id: "radio", slot: "furnR", name: "꽃무늬 라디오", price: { star: 800 }, desc: "음표가 흘러나와요" },
  { id: "cloudbed", slot: "furnR", name: "구름 침대", source: "시작 꾸러미 전용" },
  // 창가(창문 아래 턱)
  { id: "sill_cactus", slot: "sill", name: "꼬마 선인장", price: { star: 300 } },
  { id: "sill_cat", slot: "sill", name: "고양이 인형", price: { star: 450 }, desc: "가끔 꼬리를 흔들어요" },
  { id: "sill_jar", slot: "sill", name: "별 유리병", price: { gem: 60 }, desc: "밤이면 반짝여요" },
  // 벽걸이(오른쪽 벽)
  { id: "wall_clock", slot: "wallR", name: "벽시계", price: { star: 500 }, desc: "진짜 시각을 가리켜요" },
  { id: "wall_shelf", slot: "wallR", name: "꽃 선반", price: { star: 400 } },
  { id: "wall_garland", slot: "wallR", name: "알록 깃발", price: { gem: 60 } },
  // 바닥 소품(앞쪽 모서리)
  { id: "prop_ball", slot: "prop", name: "알록 공", price: { star: 250 } },
  { id: "prop_bear", slot: "prop", name: "곰 인형", price: { star: 600 } },
  { id: "prop_train", slot: "prop", name: "장난감 기차", price: { gem: 90 }, desc: "칙칙폭폭 연기가 나요" },
  // 놀이방
  { id: "play_slide", slot: "playL", name: "미끄럼틀", price: { star: 800 } },
  { id: "play_tent", slot: "playL", name: "꼬마 텐트", price: { star: 700 } },
  { id: "play_pool", slot: "playM", name: "볼풀", price: { star: 900 }, desc: "알록달록 공이 가득" },
  { id: "play_blocks", slot: "playM", name: "쌓기 블록", price: { star: 500 } },
  { id: "play_tramp", slot: "playR", name: "트램펄린", price: { gem: 90 }, desc: "통통 튀어요" },
  { id: "play_swing", slot: "playR", name: "그네", price: { gem: 120 }, desc: "흔들흔들" },
  // 머리
  { id: "hat_ribbon", slot: "hat", name: "리본", price: { star: 500 } },
  { id: "hat_straw", slot: "hat", name: "밀짚모자", price: { gem: 60 } },
  { id: "hat_glasses", slot: "hat", name: "동글 안경", price: { gem: 60 } },
  { id: "hat_crown", slot: "hat", name: "작은 왕관", price: { gem: 120 } },
  { id: "hat_flower", slot: "hat", name: "꽃 머리띠", price: { star: 400 } },
];

export const ITEM = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
export const BASIC_EQUIP = { wall: "wall_basic", floor: "floor_wood", rug: "rug_pink" };

// 상점 탭
export const TABS = [
  { id: "pick", name: "추천" },
  { id: "room", name: "방", slots: ["wall", "floor", "rug", "curtain"] },
  { id: "furn", name: "가구", slots: ["furnL", "furnR", "sill", "wallR", "prop"] },
  { id: "play", name: "놀이방", slots: ["playL", "playM", "playR"] },
  { id: "hat", name: "옷", slots: ["hat"] },
  { id: "soon", name: "알·산책" },
  { id: "gem", name: "하트 보석" },
];
export const PICKS = ["sofa", "wall_berry", "lamp", "hat_ribbon", "rug_rainbow", "fishbowl"]; // 추천 탭

// 돈으로 사는 보석 상품(앱에서만). sku는 Play 콘솔 상품 id와 같게.
// 하트 보석 → 별사탕 바꾸기(2026-10-09 사용자 결정 "돈이 있으면 별사탕을 살 수 있어야", 경제 자문 숫자).
// 새 플레이 상품 없이 보석을 서버 지갑에서 빼고 별사탕은 기기에 넣음(환불·청약철회 장부는 보석에만). 비율은 보석 꾸미기를 직접 사는 것보다 일부러 나쁘게(1:3~1:4).
// 하루 1번, 일주일(최근 7일)에 보석 400개까지(서버가 셈). 받은 보석부터 씀.
export const STAR_SWAPS = [
  { id: "s1", gem: 60, star: 180 },
  { id: "s2", gem: 150, star: 500, bonus: "+11% 더" },
  { id: "s3", gem: 400, star: 1600, bonus: "+33% 더" },
];
export const STAR_SWAP_WEEK_GEMS = 400;
export const starSwapId = (sw, now) => `star_${sw.id}_${Math.floor(now)}_${Math.random().toString(36).slice(2, 10)}`;
export const starSwapOf = (itemId) => { const m = /^star_(s[1-3])_\d{10,14}_[a-z0-9]{1,12}$/.exec(String(itemId)); return m ? STAR_SWAPS.find((x) => x.id === m[1]) || null : null; };
export const PACKS = [
  { id: "starter", sku: "starter_pack", name: "시작 꾸러미", krw: 3300, gems: 300, stars: 1000, items: ["cloudbed"], once: true, desc: "하트 보석 300 + 구름 침대 + 별사탕 1,000" },
  { id: "gem60", sku: "gem_60", name: "하트 보석 60", krw: 1100, gems: 60 },
  { id: "gem330", sku: "gem_330", name: "하트 보석 330", krw: 5500, gems: 330, bonus: "+10% 더" },
  { id: "gem720", sku: "gem_720", name: "하트 보석 720", krw: 11000, gems: 720, bonus: "+20% 더" },
  { id: "gem1500", sku: "gem_1500", name: "하트 보석 1,500", krw: 22000, gems: 1500, bonus: "+25% 더" },
];
export const PACK = Object.fromEntries(PACKS.map((p) => [p.id, p]));

// 알 해금(서버 지갑이 소유를 관리, 꾸미기 칸 없음). 무지개 알은 하트 보석으로 한 번 열면 계속(2026-10-06 사용자 결정, 경제 자문 가격 150 = 바다 알의 절반)
export const UNLOCKS = [
  { id: "theme_fantasy", theme: "fantasy", name: "무지개 알", price: { gem: 150 } },
  // 산책 코스(2026-10-08 사용자 요청). 공원은 기본. 가격은 곧 나올 상품으로 예고했던 산책 장소 값(보석 200)
  { id: "walk_beach", walk: "beach", name: "바닷가 산책", desc: "꽃게·조개껍데기·밀려오는 파도", price: { gem: 200 } },
  { id: "walk_mountain", walk: "mountain", name: "산길 산책", desc: "다람쥐·버섯·개울(겨울엔 눈 덮인 산)", price: { gem: 200 } },
  { id: "walk_lake", walk: "lake", name: "숲속 호수 산책", desc: "아기 오리·네잎클로버·개구리, 나무 데크 길", price: { gem: 200 } },
];
export const WALK_UNLOCK = { beach: "walk_beach", mountain: "walk_mountain", lake: "walk_lake" }; // 공원은 늘 열림
export const UNLOCK = Object.fromEntries(UNLOCKS.map((u) => [u.id, u]));
// 친구 부활권: 여행 떠난 친구를 도감 기록으로 다시 데려옴. 기록마다 한 번(서버 지갑 상품 id "revive_<태어난 시각>"). 2026-10-08 사용자 결정(유료), 경제 자문 가격 200
export const REVIVE = { name: "친구 부활권", price: { gem: 200 } };
export const candyItemId = (bornAt, now) => `candy_${Math.floor(bornAt || 0)}_${Math.floor(now)}_${Math.random().toString(36).slice(2, 10)}`; // 앞 숫자=이 친구가 태어난 때(값은 친구마다 60·90·120), 살 때마다 새 id // 살 때마다 새 id(시계를 맞춰 옛 id를 다시 쓰는 허점 막기) // 새 마음 사탕 1개 사기(서버 지갑 상품, 살 때마다 새 id). 값은 economy FORGIVE.price
export const reviveItemId = (rec) => `revive_${Math.floor(rec.bornAt || 0)}_${Math.floor(rec.endedAt || 0)}`; // 떠날 때마다 새 부활권(같은 친구가 다시 떠나면 또 사야, 2026-10-09 허점 수정)
export const REVIVE_FREE_BEFORE = 0; // 무료 데려오기 없음(2026-10-09 사용자 결정: 도감에서 데려오기는 늘 유료, 플레이어 잘못엔 대가가 있어야)

// 곧 나올 상품(알·산책 탭에 미리 보여 주기만)
export const SOON = [
  { id: "egg_sea", name: "바다 친구들 알", desc: "새 계통 9종 + 숨은 친구", price: { gem: 300 } },
];

// 기본 상품을 가진 상태로 만든다(새 저장·옛 저장 모두)
export function ensureBasics(e, now) {
  for (const it of ITEMS) if (it.basic && !e.owned[it.id]) e.owned[it.id] = now;
  for (const [slot, id] of Object.entries(BASIC_EQUIP)) if (!e.equipped[slot]) e.equipped[slot] = id;
}
