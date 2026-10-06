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
  { id: "furn", name: "가구", slots: ["furnL", "furnR"] },
  { id: "hat", name: "옷", slots: ["hat"] },
  { id: "soon", name: "알·산책" },
  { id: "gem", name: "하트 보석" },
];
export const PICKS = ["sofa", "wall_berry", "lamp", "hat_ribbon", "rug_rainbow", "fishbowl"]; // 추천 탭

// 돈으로 사는 보석 상품(앱에서만). sku는 Play 콘솔 상품 id와 같게.
export const PACKS = [
  { id: "starter", sku: "starter_pack", name: "시작 꾸러미", krw: 3300, gems: 300, stars: 1000, items: ["cloudbed"], once: true, desc: "하트 보석 300 + 구름 침대 + 별사탕 1,000" },
  { id: "gem60", sku: "gem_60", name: "하트 보석 60", krw: 1100, gems: 60 },
  { id: "gem330", sku: "gem_330", name: "하트 보석 330", krw: 5500, gems: 330, bonus: "+10% 더" },
  { id: "gem720", sku: "gem_720", name: "하트 보석 720", krw: 11000, gems: 720, bonus: "+20% 더" },
  { id: "gem1500", sku: "gem_1500", name: "하트 보석 1,500", krw: 22000, gems: 1500, bonus: "+25% 더" },
];
export const PACK = Object.fromEntries(PACKS.map((p) => [p.id, p]));

// 알 해금(서버 지갑이 소유를 관리, 꾸미기 칸 없음). 무지개 알은 하트 보석으로 한 번 열면 계속(2026-10-06 사용자 결정, 경제 자문 가격 150 = 바다 알의 절반)
export const UNLOCKS = [{ id: "theme_fantasy", theme: "fantasy", name: "무지개 알", price: { gem: 150 } }];
export const UNLOCK = Object.fromEntries(UNLOCKS.map((u) => [u.id, u]));

// 곧 나올 상품(알·산책 탭에 미리 보여 주기만)
export const SOON = [
  { id: "egg_sea", name: "바다 친구들 알", desc: "새 계통 9종 + 숨은 친구", price: { gem: 300 } },
  { id: "walk_beach", name: "바닷가 산책", desc: "모래성·조개·파도", price: { gem: 200 } },
  { id: "walk_snow", name: "눈 덮인 산 산책", desc: "눈사람·썰매·발자국", price: { gem: 200 } },
];

// 기본 상품을 가진 상태로 만든다(새 저장·옛 저장 모두)
export function ensureBasics(e, now) {
  for (const it of ITEMS) if (it.basic && !e.owned[it.id]) e.owned[it.id] = now;
  for (const [slot, id] of Object.entries(BASIC_EQUIP)) if (!e.equipped[slot]) e.equipped[slot] = id;
}
