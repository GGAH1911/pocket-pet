// 표정 체계: 얼굴 부품(눈·입·덧붙임)을 캐릭터 격자 위에 얹는다.
// - 상태별 표정 묶음에서 섞어 뽑기(방금 본 표정은 바로 다시 안 나옴)
// - 펫마다 즐겨 짓는 표정(성격), 어른 종류별 버릇, 가끔 나오는 희귀 표정
// 부품을 몸과 따로 그리므로 모든 캐릭터가 같은 표정 세트를 쓴다.

export const EYES = {
  dot: ["k", "k"],
  round: ["wk", "kk"],
  sparkle: ["wkk", "kkk", "kkw"],
  happy: [".k.", "k.k"],
  closed: ["kkk"],
  sleepy: ["kkk", ".k."],
  teary: ["wk", "kk", "bb"],
  x: ["k.k", ".k.", "k.k"],
  spiral: ["kkk", "k.k", ".kk"],
  heart: ["r.r", "rrr", ".r."],
  star: [".Y.", "YYY", ".Y."],
  surprised: ["kkk", "k.k", "kkk"],
};
export const MOUTHS = {
  smile: ["k.k", ".k."],
  bigsmile: ["kkkk", "kPPk", ".kk."],
  cat: ["k.k.k", ".k.k."],
  tongue: ["kkk", ".P."],
  flat: ["kk"],
  sad: [".k.", "k.k"],
  open: [".k.", "kPk", ".k."],
  o: ["kk", "kk"],
  wavy: ["k.k.", ".k.k"],
  drool: ["kk.", "..b"],
  yawn: [".kk.", "kPPk", "kPPk", ".kk."],
};

// 상태별 표정 묶음
export const POOLS = {
  great: [
    { L: "round", m: "smile", ex: ["blush"] },
    { L: "happy", m: "bigsmile" },
    { L: "round", m: "cat", id: "cat" },
    { L: "happy", R: "round", m: "smile", id: "wink" },
    { L: "sparkle", m: "bigsmile", id: "sparkle" },
    { L: "happy", m: "tongue", id: "tongue" },
    { L: "round", m: "o", ex: ["note"] },
    { L: "closed", m: "smile", ex: ["blush"] },
  ],
  ok: [
    { L: "round", m: "smile" },
    { L: "dot", m: "smile" },
    { L: "round", m: "flat", look: 1 },
    { L: "happy", m: "smile" },
    { L: "round", m: "cat", id: "cat" },
    { L: "dot", m: "o" },
  ],
  peckish: [
    { L: "round", m: "drool" },
    { L: "round", m: "o", dy: -1 },
    { L: "dot", m: "wavy" },
    { L: "round", m: "flat", ex: ["question"] },
  ],
  hungry: [
    { L: "teary", m: "sad" },
    { L: "round", m: "open", ex: ["sweat"] },
    { L: "sleepy", m: "drool" },
    { L: "dot", m: "wavy", ex: ["sweat"] },
  ],
  bored: [
    { L: "sleepy", m: "flat" },
    { L: "dot", m: "o" },
    { L: "dot", m: "sad" },
    { L: "sleepy", m: "wavy" },
    { L: "round", m: "flat", dy: 1 },
  ],
  crying: [
    { L: "teary", m: "open" },
    { L: "closed", m: "sad" },
    { L: "teary", m: "wavy" },
    { L: "x", m: "open" },
  ],
  sick: [
    { L: "spiral", m: "wavy" },
    { L: "sleepy", m: "sad", ex: ["sweat"] },
    { L: "x", m: "flat" },
    { L: "teary", m: "o" },
  ],
  sleepy: [
    { L: "sleepy", m: "yawn" },
    { L: "sleepy", m: "flat" },
    { L: "closed", m: "smile" },
  ],
  dirty: [
    { L: "x", m: "wavy" },
    { L: "round", m: "sad", ex: ["sweat"] },
    { L: "sleepy", m: "flat", ex: ["sweat"] },
  ],
  rare: [
    { L: "heart", m: "bigsmile", id: "heart", ex: ["blush"] },
    { L: "star", m: "open", id: "star" },
    { L: "sparkle", m: "tongue", id: "sparkleTongue", ex: ["blush"] },
  ],
};

// 지금 상태 → 표정 묶음 이름 (위가 우선)
export function moodKey(pet) {
  if (!pet || pet.stage === "egg") return "ok";
  const s = pet.stats;
  if (s.hunger <= 0 || s.mood <= 0) return "crying";
  if (pet.sick) return "sick";
  if (s.hunger <= 20) return "hungry";
  if (s.clean <= 30) return "dirty";
  if (s.mood <= 20) return "bored";
  if (s.energy <= 20) return "sleepy";
  if (s.hunger < 50 || s.mood < 45) return "peckish";
  if (s.mood >= 70 && s.hunger >= 50) return "great";
  return "ok";
}

const hash = (n) => { const x = Math.sin(n * 91.345) * 47453.5453; return x - Math.floor(x); };
const BRANCH_HABIT = { A: "sparkle", B: "cat", C: "wink", D: "tongue" };

// 펫 성격: 즐겨 짓는 표정 2개(시드 기준) + 어른 종류별 버릇 → 3배 자주
function weightOf(expr, i, key, pet) {
  let w = 1;
  const seed = Math.floor((pet?.bornAt || 0) / 1000);
  const favA = Math.floor(hash(seed) * 8), favB = Math.floor(hash(seed + 7) * 8);
  if ((key === "great" || key === "ok") && (i === favA || i === favB)) w *= 3;
  if (pet?.stage === "adult" && expr.id && expr.id === BRANCH_HABIT[pet.branch]) w *= 3;
  return w;
}

export function createFacePicker() {
  return { key: null, cur: null, next: 0, recent: [] };
}

// 표정 고르기. force: 앱을 열 때·돌본 뒤처럼 바로 바꾸고 싶을 때
export function pickFace(fp, pet, now, { force = false } = {}) {
  const key = moodKey(pet);
  if (!force && fp.key === key && fp.cur && now < fp.next) return fp.cur;
  let pool = POOLS[key];
  let poolName = key;
  if ((key === "great" || key === "ok") && Math.random() < 1 / 40) { pool = POOLS.rare; poolName = "rare"; }
  const cands = pool.map((e, i) => ({ e, i, w: weightOf(e, i, poolName, pet) })).filter((c) => !fp.recent.includes(`${poolName}:${c.i}`) || pool.length <= 2);
  const total = cands.reduce((a, c) => a + c.w, 0);
  let r = Math.random() * total, chosen = cands[0];
  for (const c of cands) { r -= c.w; if (r <= 0) { chosen = c; break; } }
  fp.recent = [...fp.recent, `${poolName}:${chosen.i}`].slice(-2);
  fp.key = key;
  fp.cur = { ...chosen.e, pool: poolName };
  fp.next = now + 10000 + Math.random() * 10000;
  return fp.cur;
}

// 애니메이션이 지정한 눈·입 이름 → 표정 부품 이름
const ANIM_EYES = { open: "round", closed: "closed", sleep: "closed", happy: "happy", x: "x" };

function stamp(g, art, cx, cy, mirror = false) {
  const h = art.length, w = art[0].length;
  const x0 = Math.round(cx - (w - 1) / 2), y0 = Math.round(cy - (h - 1) / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = art[y][mirror ? w - 1 - x : x];
    if (ch === ".") continue;
    const gx = x0 + x, gy = y0 + y;
    if (gx >= 0 && gy >= 0 && gx < g.w && gy < g.h) g.c[gy * g.w + gx] = ch;
  }
}

// 격자(g)에 얼굴을 얹는다. P: 캐릭터 기준점, expr: 표정, pose: 애니메이션이 지정한 눈·입(있으면 우선)
// 돌려주는 값: 눈 위치(눈물용), 덧붙임 글자(음표·물음표)
export function drawFace(g, P, expr, pose = {}) {
  const look = (expr?.look || 0) * P.f;
  const fcx = P.cx + (P.rx >= 10 ? P.f * Math.round(P.rx * 0.12) : 0) + look; // 작은 몸은 얼굴을 가운데에
  const eyeY = Math.round(P.cy - P.ry * 0.12) + (expr?.dy || 0);
  const edx = Math.max(2, Math.round(P.rx * 0.38));
  const L = pose.eyes ? ANIM_EYES[pose.eyes] || "round" : expr?.L || "round";
  const R = pose.eyes ? L : expr?.R || L;
  const m = pose.mouth ? pose.mouth : expr?.m || "smile";
  stamp(g, EYES[L] || EYES.round, fcx - edx, eyeY);
  stamp(g, EYES[R] || EYES.round, fcx + edx, eyeY, true);
  const my = eyeY + Math.max(3, Math.round(P.ry * 0.32));
  stamp(g, MOUTHS[m] || MOUTHS.smile, fcx, my);
  const ex = pose.eyes ? [] : expr?.ex || [];
  if (ex.includes("blush") || !pose.eyes) {
    // 볼은 늘 살짝, blush면 진하게
    const col = ex.includes("blush") ? "P" : "R";
    for (const s of [-1, 1]) { const bx = fcx + s * (edx + 1), by = eyeY + 2; if (g.c[by * g.w + bx] && g.c[by * g.w + bx] !== "k") { g.c[by * g.w + bx] = col; if (ex.includes("blush")) g.c[by * g.w + bx + s] = g.c[by * g.w + bx + s] && g.c[by * g.w + bx + s] !== "k" ? col : g.c[by * g.w + bx + s]; } }
  }
  if (ex.includes("sweat")) stamp(g, [".b", "bb"], fcx + edx + 3, eyeY - 3);
  return {
    eyes: [[fcx - edx, eyeY], [fcx + edx, eyeY]],
    texts: [...(ex.includes("note") ? ["♪"] : []), ...(ex.includes("question") ? ["?"] : [])],
  };
}
