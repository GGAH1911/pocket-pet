// 상점·꾸미기·매일 선물 화면. 상태와 규칙은 core/economy.js·catalog.js, 여기는 DOM만.
import { ITEMS, ITEM, SLOTS, TABS, PICKS, PACKS, SOON } from "../core/catalog.js?v=4532693-1791199752";
import { canAfford, gems, DAILY } from "../core/economy.js?v=4532693-1791199752";
import { drawThumb } from "../render/deco.js?v=4532693-1791199752";
import { SPRITES, drawSprite, spriteSize } from "../render/sprites.js?v=4532693-1791199752";

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids) if (c != null) e.append(c);
  return e;
};

// 도트 아이콘 캔버스(정수배로 가운데)
export function spriteCanvas(name, w = 16, h = 16) {
  const cv = el("canvas", { width: w, height: h });
  const sp = SPRITES[name]; if (!sp) return cv;
  const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  const { w: sw, h: sh } = spriteSize(sp);
  const sc = Math.max(1, Math.floor(Math.min(w / sw, h / sh)));
  drawSprite(ctx, sp, Math.floor((w - sw * sc) / 2), Math.floor((h - sh * sc) / 2), sc);
  return cv;
}
// 상점 칸 안 정렬: 칸(벽지·바닥…) 묶음은 유지, 그 안에서 기본 → 별사탕 싼 순 → 하트 보석 싼 순 → 파는 물건 아님(보상·꾸러미 전용).
// 가졌는지로는 다시 줄 세우지 않음(사고 나면 자리가 바뀌어 헷갈리니까. '있음/끼움' 표시로만 구분).
export function sortForShop(items, slots) {
  const rank = (it) => (it.basic ? 0 : it.price?.star ? 1 : it.price?.gem ? 2 : 3);
  const cost = (it) => it.price?.star || it.price?.gem || 0;
  return items.map((it, i) => ({ it, i })).sort((a, b) =>
    slots.indexOf(a.it.slot) - slots.indexOf(b.it.slot) || rank(a.it) - rank(b.it) || cost(a.it) - cost(b.it) || a.i - b.i).map((x) => x.it);
}

export function priceEl(price) {
  if (!price) return el("span", { class: "price" });
  const isGem = !!price.gem;
  return el("span", { class: "price" }, spriteCanvas(isGem ? "coinGem" : "coinStar", 8, 8), document.createTextNode((isGem ? price.gem : price.star).toLocaleString()));
}
const thumb = (item, w = 56, h = 46) => { const cv = el("canvas", { width: w, height: h }); drawThumb(cv, item, performance.now()); return cv; };
const won = (n) => `${n.toLocaleString()}원`;

// ---------- 상점 ----------
// ctx: { econ, state:{tab, sel}, isApp, onSelect(item), onBuy(item), onEquip(item), onPack(pack), onRestore(), onGoGem(), rerender() }
export function renderShop(tabsEl, bodyEl, ctx) {
  const { econ, state } = ctx;
  tabsEl.innerHTML = "";
  for (const t of TABS) tabsEl.append(el("button", { class: `tab${state.tab === t.id ? " on" : ""}`, text: t.name, onclick: () => { state.tab = t.id; state.sel = null; ctx.onSelect(null); ctx.rerender(); } }));
  bodyEl.innerHTML = "";
  if (state.tab === "gem") return renderGemShop(bodyEl, ctx);
  if (state.tab === "soon") {
    const cards = el("div", { class: "cards" });
    for (const s of SOON) cards.append(el("div", { class: "card" }, el("canvas", { width: 56, height: 46 }), el("span", { class: "nm", text: s.name }), el("span", { class: "small dim", text: "곧 나와요" })));
    bodyEl.append(el("p", { class: "fine", text: "새 알(새 친구 9종)과 산책 장소를 만들고 있어요." }), cards);
    for (const [i, s] of SOON.entries()) { const cv = cards.children[i].querySelector("canvas"); const c = cv.getContext("2d"); c.fillStyle = "#fbefe3"; c.fillRect(0, 0, 56, 46); const sp = SPRITES[s.id.startsWith("egg") ? "eggRainbow" : "ball"]; if (sp) drawSprite(c, sp, 20, 12, 1); c.fillStyle = "#3b2c35"; c.font = "bold 9px system-ui"; c.textAlign = "center"; c.fillText("준비 중", 28, 42); }
    return;
  }
  const tab = TABS.find((t) => t.id === state.tab);
  const list = state.tab === "pick" ? PICKS.map((id) => ITEM[id]) : sortForShop(ITEMS.filter((it) => tab.slots.includes(it.slot) && (it.price || econ.owned[it.id])), tab.slots); // 추천은 손으로 고른 순서 그대로
  const cards = el("div", { class: "cards" });
  for (const it of list) {
    const owned = !!econ.owned[it.id], on = econ.equipped[it.slot] === it.id;
    cards.append(el("button", { class: `card${state.sel === it.id ? " sel" : ""}`, onclick: () => { state.sel = it.id; ctx.onSelect(it); ctx.rerender(); } },
      owned ? el("span", { class: `tag${on ? " on" : ""}`, text: on ? "끼움" : "있음" }) : null,
      thumb(it), el("span", { class: "nm", text: it.name }), owned ? el("span", { class: "small dim", text: " " }) : priceEl(it.price)));
  }
  bodyEl.append(cards);
  // 아래 사기 막대
  const it = state.sel && ITEM[state.sel];
  const bar = el("div", { class: "buybar" });
  if (!it) { bar.append(el("div", { class: "info small dim", text: "상품을 누르면 방에 미리 놓아 볼 수 있어요" })); bodyEl.append(bar); return; }
  const owned = !!econ.owned[it.id], on = econ.equipped[it.slot] === it.id;
  bar.append(el("div", { class: "info" }, el("b", { text: it.name }), document.createTextNode(it.desc || (owned ? "가지고 있어요" : it.source ? `${it.source}로 얻어요` : "방에 미리 놓여 있어요"))));
  if (owned) bar.append(el("button", { text: on ? "끼우는 중" : "끼우기", disabled: on, onclick: () => ctx.onEquip(it) }));
  else if (it.price) {
    const ok = canAfford(econ, it.price);
    if (!ok && it.price.gem) bar.append(el("button", { class: "ghost", text: "하트 보석 사기", onclick: () => ctx.onGoGem() }));
    bar.append(el("button", { disabled: !ok, onclick: () => ctx.onBuy(it) }, priceEl(it.price), document.createTextNode(ok ? " 사기" : " 모자라요")));
  }
  bodyEl.append(bar);
}

function renderGemShop(box, ctx) {
  const { econ } = ctx;
  box.append(el("div", { class: "paynote" }, el("i"), document.createTextNode("초록 버튼은 진짜 돈이 나가요. 구글 결제 화면에서 한 번 더 확인해요")));
  if (!econ.bought.starter) {
    const st = PACKS.find((p) => p.once);
    box.append(el("div", { class: "banner" }, el("b", { text: "처음 한 번만! 시작 꾸러미" }), document.createTextNode(st.desc),
      el("div", { class: "row", style: "margin-top:8px" }, el("span", { class: "small dim", style: "flex:1", text: "한 번만 살 수 있어요" }), el("button", { class: "krw", text: won(st.krw), onclick: () => ctx.onPack(st) }))));
  }
  for (const p of PACKS.filter((x) => !x.once)) {
    box.append(el("button", { class: "pack", onclick: () => ctx.onPack(p) }, spriteCanvas("coinGem", 32, 26), el("span", { class: "g" }, document.createTextNode(p.name), el("small", { text: p.bonus || "기본" })), el("span", { class: "krw", text: won(p.krw) })));
  }
  box.append(el("p", { class: "fine", text: `가진 하트 보석 ${gems(econ)}개 (산 것 ${econ.gemPaid}, 받은 것 ${econ.gemFree}). 받은 것부터 먼저 써요.` }));
  box.append(el("p", { class: "fine", text: "쓰지 않은 산 하트 보석은 산 날부터 7일 안에 환불을 요청할 수 있어요. 이미 쓴 하트 보석과 꾸미기 상품은 사기 전에 방에 미리 놓아 볼 수 있어서 환불이 어려워요. 랜덤 뽑기는 없어요." }));
  if (!ctx.isApp) box.append(el("p", { class: "warn small", text: "하트 보석은 플레이스토어 앱에서 살 수 있어요(준비 중). 지금은 매일 선물과 비밀 찾기로 받을 수 있어요." }));
  box.append(el("button", { class: "big ghost", text: "구매 복원", onclick: () => ctx.onRestore() }));
}

// ---------- 꾸미기 모드 ----------
// ctx: { econ, state:{slot}, onEquip(item|null, slot), onLocked(item), rerender() }
const EMPTY_OK = new Set(["curtain", "furnL", "furnR", "hat"]);
export function renderDeco(slotsEl, stripEl, ctx) {
  const { econ, state } = ctx;
  slotsEl.innerHTML = ""; stripEl.innerHTML = "";
  for (const s of SLOTS) slotsEl.append(el("button", { class: `tab${state.slot === s.id ? " on" : ""}`, text: s.name, onclick: () => { state.slot = s.id; ctx.rerender(); } }));
  const cur = econ.equipped[state.slot];
  if (EMPTY_OK.has(state.slot)) stripEl.append(el("button", { class: `it${!cur ? " on" : ""}`, onclick: () => ctx.onEquip(null, state.slot) }, el("canvas", { width: 56, height: 46 }), document.createTextNode("없음")));
  const items = ITEMS.filter((it) => it.slot === state.slot);
  items.sort((a, b) => (econ.owned[b.id] ? 1 : 0) - (econ.owned[a.id] ? 1 : 0));
  for (const it of items) {
    const owned = !!econ.owned[it.id];
    if (!owned && !it.price) continue; // 못 사는 보상·꾸러미 전용은 가졌을 때만
    stripEl.append(el("button", { class: `it${cur === it.id ? " on" : ""}${owned ? "" : " lock"}`, onclick: () => (owned ? ctx.onEquip(it, state.slot) : ctx.onLocked(it)) },
      owned ? null : el("span", { class: "lk" }, priceEl(it.price)), thumb(it), document.createTextNode(it.name)));
  }
}

// ---------- 매일 선물 ----------
export function dailyCard({ status, onClaim, onClose }) {
  const stamps = el("div", { class: "stamp" });
  DAILY.forEach((r, i) => {
    const done = i < status.idx, today = status.available && i === status.idx;
    stamps.append(el("div", { class: `st${done ? " done" : ""}${today ? " today" : ""}${r.gem ? " gemday" : ""}` }, document.createTextNode(`${i + 1}`), spriteCanvas(r.gem ? "coinGem" : "coinStar", 8, 8), document.createTextNode(String(r.gem || r.star))));
  });
  const card = el("div", { class: "dexcard" });
  const inner = el("div", { class: "dexcard-in" }, el("b", { text: status.available ? "오늘의 선물" : "오늘 선물은 받았어요" }),
    el("div", { class: "small dim", text: "하루 한 번 열어 보기만 하면 돼요. 하루 빠져도 처음으로 안 돌아가요" }), stamps);
  if (status.available) inner.append(el("button", { class: "big", text: "받기", onclick: () => { onClaim(); card.remove(); } }));
  inner.prepend(el("button", { class: "x", "aria-label": "닫기", text: "✕", onclick: () => { card.remove(); onClose?.(); } }));
  card.append(inner);
  card.addEventListener("click", (e) => { if (e.target === card) card.remove(); });
  return card;
}
