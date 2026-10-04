// 도감: 본 적 있는 모습 표시, 지금까지 키운 펫 기록, 초상화 그리기
import { FORMS, buildCreature, paintGrid, formKey, lookOf } from "../render/creature.js?v=f6105a2-1791123013";
import { drawFace, POOLS } from "../render/face.js?v=f6105a2-1791123013";
import { SPRITES, drawSprite } from "../render/sprites.js?v=f6105a2-1791123013";

export const THEME_KO = { animal: "동물", fantasy: "상상 속 생물" };
export const HOW_KO = { journey: "여행을 떠남", runaway: "삐져서 떠남", star: "별이 됨", retired: "새 알에게 자리를 물려줌" };
const SPEED_KO = { slow: "느긋", normal: "보통", fast: "빠름" };

export function formOrder(theme) {
  return [`${theme}.baby`, `${theme}.child`, `${theme}.teen.good`, `${theme}.teen.normal`, `${theme}.adult.A`, `${theme}.adult.B`, `${theme}.adult.C`, `${theme}.adult.D`, `${theme}.adult.S`];
}

export function currentKey(pet) {
  return pet.stage === "egg" ? null : formKey(pet.theme, pet.stage, pet.branch);
}

export function markSeen(profile, pet) {
  const k = pet && currentKey(pet);
  if (k && !profile.seen[k]) { profile.seen[k] = true; return true; }
  return false;
}

export function recordPet(profile, pet) {
  const key = currentKey(pet) || `${pet.theme}.egg`;
  const rec = {
    name: pet.name, theme: pet.theme, key, form: FORMS[key]?.name || "알",
    how: pet.ended?.type || "retired", bornAt: pet.bornAt, endedAt: pet.ended?.at || Date.now(),
    ageDays: Math.round((pet.ageMin / 1440) * 10) / 10, mistakes: pet.mistakes.total, speed: pet.speed, weight: pet.weight,
    look: lookOf(pet),
  };
  profile.collection.push(rec);
  return rec;
}

// 캔버스에 초상화(가운데, 발밑 기준)
export function portrait(canvas, key, look = {}, { silhouette = false, face = POOLS.great[1] } = {}) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!key || key.endsWith(".egg")) { drawSprite(ctx, key && key.startsWith("fantasy") ? SPRITES.eggRainbow : SPRITES.egg, canvas.width / 2 - 8, canvas.height - 22, 1); return; }
  const b = buildCreature(key, { look, silhouette: silhouette ? "L" : null });
  if (!b) return;
  if (!silhouette) drawFace(b.g, b.P, face);
  // 가장 큰 형태도 들어가게 1칸=1px
  paintGrid(ctx, b.g, canvas.width / 2, canvas.height - 3, 1);
}

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else e.setAttribute(k, v);
  for (const c of kids) if (c) e.append(c);
  return e;
}

export function renderCollection(box, profile) {
  box.innerHTML = "";
  for (const theme of ["animal", "fantasy"]) {
    const keys = formOrder(theme);
    const seenN = keys.filter((k) => profile.seen[k]).length;
    box.append(el("h3", { text: `${THEME_KO[theme]} ${seenN}/${keys.length}` }));
    const grid = el("div", { class: "dex" });
    for (const k of keys) {
      const seen = !!profile.seen[k];
      const cv = el("canvas", { width: 56, height: 46 });
      portrait(cv, k, { spot: "p" }, { silhouette: !seen });
      const secret = FORMS[k]?.secret;
      grid.append(el("figure", { class: seen ? "" : "unseen" }, cv, el("figcaption", { text: seen ? FORMS[k].name : secret ? "숨은 친구" : "?" })));
    }
    box.append(grid);
  }
  box.append(el("h3", { text: `함께한 친구들 ${profile.collection.length}` }));
  if (!profile.collection.length) box.append(el("p", { class: "small dim", text: "아직 없어요. 지금 친구를 끝까지 키우면 여기에 남아요." }));
  const list = el("div", { class: "past" });
  for (const r of [...profile.collection].reverse()) {
    const cv = el("canvas", { width: 56, height: 46 });
    portrait(cv, r.key, r.look || {});
    const d = new Date(r.endedAt);
    list.append(el("div", { class: "pastrow" }, cv, el("div", {},
      el("b", { text: `${r.name} · ${r.form}` }),
      el("div", { class: "small", text: `${HOW_KO[r.how] || r.how} · ${r.ageDays}살 · 실수 ${r.mistakes} · ${SPEED_KO[r.speed] || ""}` }),
      el("div", { class: "small dim", text: `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}` }),
    )));
  }
  box.append(list);
}

// 떠날 때 남기는 편지
export function letterText(pet) {
  const n = pet.name, how = pet.ended?.type, m = pet.mistakes.total;
  if (how === "star") return m <= 3
    ? `함께한 날들 정말 행복했어요. 이제 하늘에서 반짝이며 지켜볼게요. 밤하늘을 보면 저를 떠올려 주세요.\n- ${n}`
    : `조금 외로운 날도 있었지만, 그래도 곁에 있어서 좋았어요. 하늘에서 지켜볼게요.\n- ${n}`;
  if (how === "runaway") return `너무 배고프고 외로웠어요… 저는 다른 곳으로 가 볼게요. 다음 친구는 꼭 자주 봐 주세요.\n- ${n}`;
  if (how === "retired") return `새 친구가 오는 거죠? 저는 도감에서 늘 기다릴게요. 잘해 주세요!\n- ${n}`;
  return m <= 3
    ? `그동안 정말 고마웠어요! 맛있는 밥이랑 신나는 놀이 다 기억할게요. 넓은 세상 구경하고 올게요.\n- ${n}`
    : m <= 10
      ? `가끔 배고프고 심심했지만 즐거웠어요. 이제 여행을 떠나요. 잘 지내요!\n- ${n}`
      : `조금 외로웠어요. 그래도 고마웠어요. 다음 친구는 더 많이 안아 주세요.\n- ${n}`;
}
