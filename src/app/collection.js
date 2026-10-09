// 도감: 본 적 있는 모습 표시, 지금까지 키운 펫 기록, 초상화 그리기
import { FORMS, buildCreature, paintGrid, formKey, lookOf } from "../render/creature.js?v=635f5a9-1791540834";
import { drawFace, POOLS } from "../render/face.js?v=635f5a9-1791540834";
import { SPRITES, drawSprite } from "../render/sprites.js?v=635f5a9-1791540834";
import { BRANCH, SECRET } from "../core/rules.js?v=635f5a9-1791540834";
import { EGGS, foundCount } from "./eggs.js?v=635f5a9-1791540834";
import { canRevive } from "../core/revive.js?v=635f5a9-1791540834";

export const THEME_KO = { animal: "동물", fantasy: "상상 속 생물" };
export const HOW_KO = { journey: "여행을 떠남", runaway: "서운해서 할머니 댁에 감", star: "별이 됨", retired: "친구 마을로 이사" };
const SPEED_KO = { slow: "느긋", normal: "보통", fast: "빠름" };

export function formOrder(theme) {
  return [`${theme}.baby`, `${theme}.child`, `${theme}.teen.good`, `${theme}.teen.normal`, `${theme}.adult.A`, `${theme}.adult.B`, `${theme}.adult.C`, `${theme}.adult.D`, `${theme}.adult.S`];
}

export function currentKey(pet) {
  return pet.stage === "egg" ? null : formKey(pet.theme, pet.stage, pet.branch);
}

// 처음 만난 시각을 남긴다(옛 저장은 true)
export function markSeen(profile, pet, now = Date.now()) {
  const k = pet && currentKey(pet);
  if (k && !profile.seen[k]) { profile.seen[k] = now; return true; }
  return false;
}

// ---------- 모으기: 어른 수·보상·힌트·진행 예측 ----------
export const THEMES_ALL = ["animal", "fantasy"];
export const ADULT_KEYS = THEMES_ALL.flatMap((t) => ["A", "B", "C", "D", "S"].map((b) => `${t}.adult.${b}`));
export const adultsSeen = (profile) => ADULT_KEYS.filter((k) => profile.seen[k]);
const themeABCD = (profile, theme) => ["A", "B", "C", "D"].every((b) => profile.seen[`${theme}.adult.${b}`]);
const themeAdults = (profile, theme) => ["A", "B", "C", "D", "S"].filter((b) => profile.seen[`${theme}.adult.${b}`]).length;

// 보상: 어른 수로 열린다(놀이 수치는 안 건드리는 꾸미기·선택권만)
export const REWARDS = [
  { id: "frame", need: 1, label: "사진 액자", desc: "방 벽에 친구 사진이 걸려요. 도감에서 어떤 친구를 걸지 고를 수 있어요" },
  { id: "eggColor", need: 3, label: "알 색 고르기", desc: "새 알을 받을 때 무늬 색을 골라요. 커서도 귀 끝·점 색으로 남아요" },
  { id: "starRug", need: 5, label: "별 러그", desc: "밤하늘 별무늬 러그를 받아요(꾸미기에서 깔기)" },
  { id: "goldEgg", secret: true, label: "금빛 알", desc: "알 색 고르기에 금색이 생겨요 (숨은 친구를 만나면)" },
  { id: "goldFrame", need: ADULT_KEYS.length, label: "반짝 사진틀", desc: "어른 10종을 다 만나면 사진 액자 테두리가 금색이 돼요" },
];
export function rewardOpen(profile, r) {
  if (r.secret) return ADULT_KEYS.some((k) => k.endsWith(".S") && profile.seen[k]);
  return adultsSeen(profile).length >= r.need;
}
export const unlockedSet = (profile) => new Set(REWARDS.filter((r) => rewardOpen(profile, r)).map((r) => r.id));
export function nextGoal(profile) {
  const n = adultsSeen(profile).length;
  const r = REWARDS.filter((x) => !x.secret && x.need > n).sort((a, b) => a.need - b.need)[0];
  return r ? { reward: r, left: r.need - n } : null;
}
export const hasCrown = (profile, theme) => themeABCD(profile, theme);

// 한 줄 소개
export const BLURB = {
  "animal.baby": "동그란 솜털 공. 아직 눈만 깜빡여요",
  "animal.child": "늘어진 귀가 귀여운 아기 강아지",
  "animal.teen.good": "귀가 반쯤 선 꼬마 강아지. 칭찬을 먹고 자라요",
  "animal.teen.normal": "뾰족 귀에 긴 꼬리, 제멋대로 꼬마 고양이",
  "animal.adult.A": "의젓한 모범생. 노는 걸 제일 좋아해요",
  "animal.adult.B": "간식을 사랑한 동글동글 코기",
  "animal.adult.C": "자유로운 영혼, 풍성한 꼬리의 여우 고양이",
  "animal.adult.D": "삐죽 털 장난꾸러기. 사고뭉치지만 미워할 수 없어요",
  "animal.adult.S": "정을 듬뿍 받은 친구에게만 나타나는 별빛 사모예드",
  "fantasy.baby": "말랑말랑 물방울 슬라임",
  "fantasy.child": "작은 뿔이 돋은 말랑이",
  "fantasy.teen.good": "뿔과 날개가 돋은 아기 용",
  "fantasy.teen.normal": "몽글몽글 떠다니는 꼬마 구름",
  "fantasy.adult.A": "무지개 배를 가진 늠름한 용",
  "fantasy.adult.B": "날개보다 배가 큰 통통 용",
  "fantasy.adult.C": "하늘을 헤엄치는 느긋한 구름 고래",
  "fantasy.adult.D": "찌릿찌릿 번개를 품은 장난꾸러기 구름",
  "fantasy.adult.S": "정을 듬뿍 받은 친구에게만 나타나는 별 유니콘",
};

// 못 만난 친구를 만나는 방법(실제 규칙 그대로)
export function hintFor(key, profile) {
  const [theme, stage, br] = key.split(".");
  const teenGood = FORMS[`${theme}.teen.good`].name, teenNormal = FORMS[`${theme}.teen.normal`].name;
  if (stage === "baby" || stage === "child") return "알을 키우면 꼭 만나요";
  if (stage === "teen") return br === "good"
    ? `어린이 시절에 돌봄 실수를 ${BRANCH.childGoodMaxMistakes}번 이하로 꼼꼼히 챙겨 주면`
    : `어린이 시절에 조금 느슨하게(돌봄 실수 ${BRANCH.childGoodMaxMistakes + 1}번 이상) 키우면`;
  if (br === "A") return `${teenGood} 시절에 간식보다 놀이를 더 많이(같아도 돼요) 해 주면`;
  if (br === "B") return `${teenGood} 시절에 놀이보다 간식을 더 많이 주면`;
  if (br === "C") return `${teenNormal} 시절에 돌봄 실수를 ${BRANCH.teenFreeMaxMistakes}번 이하로 지키면`;
  if (br === "D") return `${teenNormal} 시절에 돌봄 실수가 ${BRANCH.teenFreeMaxMistakes + 1}번 이상이면(장난꾸러기!)`;
  if (br === "S") {
    if (themeABCD(profile, theme)) return `태어나서부터 돌봄 실수 ${SECRET.maxMistakes}번 + 쓰다듬기(펫을 톡) ${SECRET.minPats}번 이상이면, 청소년이 어느 쪽이든 나타나요`;
    if (themeAdults(profile, theme) >= 1) return "정을 듬뿍 준 친구에게만 나타난대요. 이 테마 어른 4종을 다 만나면 정확한 조건이 열려요";
    return "아직 비밀이에요";
  }
  return "";
}

// 지금 친구가 이대로면 어디로 가는지
export function outlook(pet, profile) {
  if (!pet || pet.ended) return null;
  const th = pet.theme, nm = (k) => FORMS[k]?.name || "";
  const tag = (k) => (profile.seen[k] ? "" : " · 아직 못 만난 친구예요!");
  const m = pet.mistakes.stage, c = pet.counts || { plays: 0, snacks: 0 };
  const secretOpen = themeABCD(profile, th);
  const secretOk = pet.mistakes.total <= SECRET.maxMistakes;
  const secretLine = secretOpen && secretOk ? ` (숨은 친구 조건: 실수 0 유지 중, 쓰다듬기 ${Math.min(pet.pats || 0, SECRET.minPats)}/${SECRET.minPats})` : "";
  if (pet.stage === "egg" || pet.stage === "baby") return { text: `${nm(`${th}.child`) || "어린이"}가 되면 갈림길이 시작돼요`, target: null };
  if (pet.stage === "child") {
    const k = m <= BRANCH.childGoodMaxMistakes ? `${th}.teen.good` : `${th}.teen.normal`;
    return { text: `어린이 · 이번 시기 돌봄 실수 ${m}번 → 이대로면 ${nm(k)}${tag(k)}${secretLine}`, target: k };
  }
  if (pet.stage === "teen") {
    if (secretOpen && secretOk && (pet.pats || 0) >= SECRET.minPats) { const k = `${th}.adult.S`; return { text: `조건을 다 채웠어요 → 이대로면 ${nm(k)}${tag(k)}`, target: k }; }
    const k = pet.branch === "good" ? `${th}.adult.${c.plays >= c.snacks ? "A" : "B"}` : `${th}.adult.${m <= BRANCH.teenFreeMaxMistakes ? "C" : "D"}`;
    const why = pet.branch === "good" ? `놀이 ${c.plays} · 간식 ${c.snacks}` : `이번 시기 돌봄 실수 ${m}번`;
    return { text: `${nm(currentKey(pet))} · ${why} → 이대로면 ${nm(k)}${tag(k)}${secretLine}`, target: k };
  }
  return { text: `어른이 됐어요: ${nm(currentKey(pet))}`, target: currentKey(pet) };
}

// 그 모습까지 키운 기록
export function formStats(profile, key) {
  const recs = profile.collection.filter((r) => r.key === key);
  return { count: recs.length, names: recs.map((r) => r.name) };
}

export function recordPet(profile, pet) {
  const key = currentKey(pet) || `${pet.theme}.egg`;
  const rec = {
    name: pet.name, theme: pet.theme, key, form: FORMS[key]?.name || "알",
    how: pet.ended?.type || "retired", bornAt: pet.bornAt, endedAt: pet.ended?.at || Date.now(),
    ageDays: Math.round((pet.ageMin / 1440) * 10) / 10, mistakes: pet.mistakes.total, speed: pet.speed, weight: pet.weight,
    look: lookOf(pet), letter: letterText(pet),
  };
  profile.collection.push(rec);
  return rec;
}

// 도감 줄의 '액자에 걸기' 버튼(지금 걸린 친구면 '걸려 있어요')
function frameBtn(opts, key, look, name) {
  const on = opts.frameKey === `${name}|${key}`;
  const b = el("button", { class: "ghost small revive", text: on ? "액자에 걸림" : "액자에 걸기" });
  if (on) b.disabled = true;
  b.addEventListener("click", (ev) => { ev.stopPropagation(); opts.onFrame?.(key, look || {}, name); });
  return b;
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

const fmtDate = (t) => { const d = new Date(t); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`; };
const EGG_COLOR_KO = { p: "분홍", g: "민트", b: "하늘", y: "노랑", v: "보라", r: "빨강", Y: "금빛" };

// 도감 화면. opts: { pet, settings }
export function renderCollection(box, profile, opts = {}) {
  box.innerHTML = "";
  const open = unlockedSet(profile);
  // 카드(칸·친구를 누르면 위에 뜸)
  const card = el("div", { class: "dexcard", hidden: "" });
  const showCard = (key, look, lines, title) => {
    card.innerHTML = "";
    const inner = el("div", { class: "dexcard-in" });
    if (key) {
      const cv = el("canvas", { width: 56, height: 46 });
      const seen = !!profile.seen[key] || !!look;
      portrait(cv, key, look || { spot: "p" }, { silhouette: !seen });
      inner.append(cv);
    }
    inner.append(el("b", { text: title }));
    for (const l of lines) if (l) inner.append(el(l.cls ? "p" : "div", { class: l.cls || "small", text: l.text }));
    const close = el("button", { class: "x", "aria-label": "닫기", text: "✕" });
    close.addEventListener("click", () => { card.hidden = true; });
    inner.prepend(close);
    card.append(inner); card.hidden = false;
    card.scrollIntoView?.({ block: "nearest" });
  };
  card.addEventListener("click", (e) => { if (e.target === card) card.hidden = true; });

  // 1) 지금 친구의 갈림길
  const ol = outlook(opts.pet, profile);
  if (ol) box.append(el("div", { class: "dexnote" }, el("b", { text: `지금 ${opts.pet.name}` }), el("div", { class: "small", text: ol.text })));

  // 2) 모으기 보상
  const n = adultsSeen(profile).length, goal = nextGoal(profile);
  box.append(el("h3", { text: `어른 친구 ${n}/${ADULT_KEYS.length}` }));
  box.append(el("p", { class: "small", text: goal ? `다음 보상 '${goal.reward.label}'까지 어른 ${goal.left}종 더` : "보상을 모두 열었어요!" }));
  const chips = el("div", { class: "rewards" });
  for (const r of REWARDS) {
    const on = open.has(r.id);
    const chip = el("button", { class: `chip${on ? " on" : ""}`, text: `${on ? "★" : "🔒"} ${r.label}` });
    chip.addEventListener("click", () => showCard(null, null, [{ text: r.desc }, { text: on ? "열렸어요!" : r.secret ? "숨은 친구를 만나면 열려요" : `어른 ${r.need}종을 만나면 열려요 (지금 ${n}종)` }], r.label));
    chips.append(chip);
  }
  box.append(chips);
  if (open.has("starRug")) box.append(el("p", { class: "small dim", text: "별 러그는 꾸미기 → 러그에서 깔 수 있어요" }));

  // 3) 테마별 계통도
  for (const theme of THEMES_ALL) {
    const keys = formOrder(theme);
    const seenN = keys.filter((k) => profile.seen[k]).length;
    box.append(el("h3", { text: `${hasCrown(profile, theme) ? "👑 " : ""}${THEME_KO[theme]} ${seenN}/${keys.length}` }));
    const tree = el("div", { class: "tree" });
    const cell = (k, cls = "") => {
      const seen = !!profile.seen[k];
      const cv = el("canvas", { width: 56, height: 46 });
      portrait(cv, k, { spot: "p" }, { silhouette: !seen });
      const secret = FORMS[k]?.secret;
      const fig = el("figure", { class: `${seen ? "" : "unseen"} ${cls}` }, cv, el("figcaption", { text: seen ? FORMS[k].name : secret ? "숨은 친구" : "?" }));
      fig.addEventListener("click", () => {
        if (seen) {
          const st = formStats(profile, k);
          showCard(k, null, [
            { text: BLURB[k] || "" },
            { text: typeof profile.seen[k] === "number" ? `처음 만난 날 ${fmtDate(profile.seen[k])}` : "" },
            { text: `이 모습으로 함께한 친구 ${st.count}명${st.count ? ` · ${st.names.join(", ")}` : ""}` },
            { text: `만나는 방법: ${hintFor(k, profile)}`, cls: "small dim" },
          ], FORMS[k].name);
        } else showCard(k, null, [{ text: "아직 못 만났어요" }, { text: `만나는 방법: ${hintFor(k, profile)}`, cls: "hint" }], secret ? "숨은 친구" : "???");
      });
      return fig;
    };
    const row = (...figs) => { const r = el("div", { class: `trow n${figs.length}` }); for (const f of figs) r.append(f); return r; };
    const arrow = () => el("div", { class: "tarrow", text: "↓" });
    tree.append(row(cell(`${theme}.baby`)), arrow(), row(cell(`${theme}.child`)), arrow(),
      row(cell(`${theme}.teen.good`, "g1"), cell(`${theme}.teen.normal`, "g2")), arrow(),
      row(cell(`${theme}.adult.A`, "g1"), cell(`${theme}.adult.B`, "g1"), cell(`${theme}.adult.C`, "g2"), cell(`${theme}.adult.D`, "g2")),
      el("div", { class: "tarrow small dim", text: "✦ 숨은 길" }), row(cell(`${theme}.adult.S`, "gs")));
    box.append(tree);
  }

  // 3-5) 친구 마을: 이사 간 친구들(돌봄 없음). 하루 한 번 지금 친구와 교대
  if (opts.village?.length) {
    box.append(el("h3", { text: `친구 마을 ${opts.village.length}` }));
    box.append(el("p", { class: "small dim", text: "마을 친구들은 배고프지도 심심하지도 않아요. 하루에 한 번 지금 친구와 바꿔 데려올 수 있어요." }));
    const vl = el("div", { class: "past" });
    opts.village.forEach((v, i) => {
      const pp = v.pet, cv = el("canvas", { width: 56, height: 46 });
      if (pp.stage === "egg") { const c2 = cv.getContext("2d"); c2.imageSmoothingEnabled = false; drawSprite(c2, SPRITES.egg, 20, 12, 1); } else portrait(cv, formKey(pp.theme, pp.stage, pp.branch), lookOf(pp));
      const row = el("div", { class: "pastrow" }, cv, el("div", {},
        el("b", { text: `${pp.name} · ${pp.stage === "egg" ? "알" : FORMS[formKey(pp.theme, pp.stage, pp.branch)]?.name || ""}` }),
        el("div", { class: "small dim", text: `${fmtDate(v.movedAt)}에 이사 왔어요` })));
      const b = el("button", { class: "ghost small revive", text: opts.canSwap ? "데려오기" : "내일 또" });
      if (!opts.canSwap) b.disabled = true;
      b.addEventListener("click", (ev) => { ev.stopPropagation(); opts.onSwap?.(i); });
      row.append(b);
      if (opts.frameOpen && pp.stage !== "egg") row.append(frameBtn(opts, formKey(pp.theme, pp.stage, pp.branch), lookOf(pp), pp.name));
      vl.append(row);
    });
    box.append(vl);
  }

  // 4) 함께한 친구들(추억 앨범)
  box.append(el("h3", { text: `함께한 친구들 ${profile.collection.length}` }));
  if (!profile.collection.length) box.append(el("p", { class: "small dim", text: "아직 없어요. 지금 친구를 끝까지 키우면 여기에 남아요. 떠날 때 남긴 편지도 다시 읽을 수 있어요." }));
  const list = el("div", { class: "past" });
  for (const r of [...profile.collection].reverse()) {
    const cv = el("canvas", { width: 56, height: 46 });
    portrait(cv, r.key, r.look || {});
    const rowEl = el("div", { class: "pastrow", role: "button", tabindex: "0" }, cv, el("div", {}, // 안에 '다시 데려오기' 버튼이 들어가서 버튼 안 버튼이 되지 않게 div
      el("b", { text: `${r.name} · ${r.form}` }),
      el("div", { class: "small", text: `${HOW_KO[r.how] || r.how} · ${r.ageDays}살 · 실수 ${r.mistakes} · ${SPEED_KO[r.speed] || ""}` }),
      el("div", { class: "small dim", text: `${fmtDate(r.endedAt)} · 편지 보기 ›${r.returnedAt ? " · 돌아왔어요" : ""}` }),
    ));
    if (opts.frameOpen && r.key && !r.key.endsWith(".egg")) rowEl.append(frameBtn(opts, r.key, r.look, r.name));
    if (opts.onRevive && canRevive(r)) { // 여행 떠난 친구 다시 데려오기
      const rb = el("button", { class: "ghost small revive", text: "다시 데려오기" });
      rb.addEventListener("click", (ev) => { ev.stopPropagation(); opts.onRevive(r); });
      rowEl.append(rb);
    }
    rowEl.addEventListener("click", () => showCard(r.key, r.look || { spot: "p" }, [
      { text: `${THEME_KO[r.theme] || ""} · ${r.form} · ${HOW_KO[r.how] || r.how}` },
      { text: `${fmtDate(r.bornAt)} ~ ${fmtDate(r.endedAt)} · ${r.ageDays}살 · 돌봄 실수 ${r.mistakes} · 몸무게 ${r.weight ?? "?"}g${r.look?.spot ? ` · ${EGG_COLOR_KO[r.look.spot] || ""} 무늬` : ""}` },
      { text: r.letter || letterText({ name: r.name, ended: { type: r.how }, mistakes: { total: r.mistakes } }), cls: "letter" },
    ], r.name));
    list.append(rowEl);
  }
  box.append(list);

  // 5) 찾은 비밀(이스터 에그)
  box.append(el("h3", { text: `찾은 비밀 ${foundCount(profile)}/${EGGS.length}` }));
  const eggsBox = el("div", { class: "secrets" });
  for (const e of EGGS) {
    const got = profile.eggs && profile.eggs[e.id];
    eggsBox.append(el("div", { class: `secret${got ? " on" : ""}` }, el("b", { text: got ? `✦ ${e.name}` : "???" }), el("div", { class: "small" + (got ? "" : " dim"), text: got ? e.desc : `힌트: ${e.hint}` })));
  }
  box.append(eggsBox);
  box.append(card);
}

export { EGG_COLOR_KO };

// 떠날 때 남기는 편지
export function letterText(pet) {
  const n = pet.name, how = pet.ended?.type, m = pet.mistakes.total;
  if (how === "star") return m <= 3
    ? `함께한 날들 정말 행복했어요. 이제 하늘에서 반짝이며 지켜볼게요. 밤하늘을 보면 저를 떠올려 주세요.\n- ${n}`
    : `조금 외로운 날도 있었지만, 그래도 곁에 있어서 좋았어요. 하늘에서 지켜볼게요.\n- ${n}`;
  // 아이가 자기 탓을 키우지 않게, 되돌릴 수 있는 말로(아동 심리 자문 2026-10-09)
  if (how === "runaway") return `조금 서운했어요… 친구 마을 할머니 댁에서 쉬고 있을게요. 맛있는 거 들고 데리러 와 줄래요?\n- ${n}`;
  if (how === "retired") return `친구 마을에 집이 생겼어요! 보고 싶으면 놀러 와요.\n- ${n}`;
  return m <= 3
    ? `그동안 정말 고마웠어요! 맛있는 밥이랑 신나는 놀이 다 기억할게요. 넓은 세상 구경하고 올게요. 엽서 보낼게요!\n- ${n}`
    : m <= 10
      ? `가끔 배고프고 심심했지만 즐거웠어요. 이제 여행을 떠나요. 엽서 보낼게요!\n- ${n}`
      : `조금 심심한 날도 있었지만 고마웠어요. 여행 다녀올게요. 엽서 보낼게요!\n- ${n}`;
}
