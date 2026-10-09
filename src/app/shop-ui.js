// 상점·꾸미기·매일 선물 화면. 상태와 규칙은 core/economy.js·catalog.js, 여기는 DOM만.
import { ITEMS, ITEM, SLOTS, TABS, PICKS, PACKS, SOON, UNLOCK, UNLOCKS } from "../core/catalog.js?v=84a5c60-1791514463";
import { drawCourseThumb } from "../render/walk-courses.js?v=84a5c60-1791514463";
import { canAfford, gems, DAILY, purchaseHistory, themeOpen, FORGIVE, forgiveState } from "../core/economy.js?v=84a5c60-1791514463";
import { gemButtonState } from "../core/wallet.js?v=84a5c60-1791514463";
import { drawThumb } from "../render/deco.js?v=84a5c60-1791514463";
import { SPRITES, drawSprite, spriteSize } from "../render/sprites.js?v=84a5c60-1791514463";

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
// ctx: { econ, state:{tab, sel}, isApp, gem:{online, busy, buy, at, pending}, onSelect(item), onBuy(item), onEquip(item), onPack(pack), onRestore(), onGoGem(), rerender() }
export function renderShop(tabsEl, bodyEl, ctx) {
  const { econ, state } = ctx;
  tabsEl.innerHTML = "";
  for (const t of TABS) tabsEl.append(el("button", { class: `tab${state.tab === t.id ? " on" : ""}`, text: t.name, onclick: () => { state.tab = t.id; state.sel = null; ctx.onSelect(null); ctx.rerender(); } }));
  bodyEl.innerHTML = "";
  if (state.tab === "gem") return renderGemShop(bodyEl, ctx);
  if (state.tab === "soon") {
    // 알 열기: 무지개 알(상상 속 생물)은 하트 보석으로 한 번 열면 다음 알부터 계속 고를 수 있음(서버 지갑, 인터넷 필요)
    const open = themeOpen(econ, "fantasy"), price = UNLOCK.theme_fantasy.price;
    const g = ctx.gem || {};
    const st = gemButtonState({ online: !!g.online, busy: !!g.busy, total: gems(econ), price: price.gem });
    bodyEl.append(el("div", { class: "banner" }, el("b", { text: "무지개 알 · 상상 속 생물" }), document.createTextNode("말랑이 → 아기 용·꼬마 구름 → 무지개 용, 구름 고래… 새 친구 8종과 숨은 친구"),
      el("div", { class: "row", style: "margin-top:8px" }, el("span", { class: "small dim", style: "flex:1", text: open ? "열렸어요. 새 알을 받을 때 고를 수 있어요" : "한 번 열면 계속 고를 수 있어요" }),
        open ? null : st.poor ? el("button", { class: "ghost", text: "하트 보석 사기", onclick: () => ctx.onGoGem() }) : null,
        open ? null : el("button", { disabled: st.disabled, onclick: () => ctx.onUnlockTheme?.("fantasy") }, priceEl(price), document.createTextNode(st.label === "사기" ? " 열기" : " " + st.label)))));
    // 산책 코스: 미리 보기 그림 + 하트 보석으로 열기(서버 지갑, 인터넷 필요)
    bodyEl.append(el("h3", { class: "sec", text: "산책 코스" }));
    for (const u of UNLOCKS.filter((x) => x.walk)) {
      const cv = el("canvas", { width: 112, height: 92, class: "coursethumb" }); drawCourseThumb(cv, u.walk);
      const have = !!econ.owned[u.id];
      const st2 = gemButtonState({ online: !!g.online, busy: !!g.busy, total: gems(econ), price: u.price.gem });
      bodyEl.append(el("div", { class: "banner course" }, cv, el("div", { class: "cinfo" }, el("b", { text: u.name }), el("div", { class: "small", text: u.desc }),
        el("div", { class: "row", style: "margin-top:6px" }, el("span", { class: "small dim", style: "flex:1", text: have ? "열렸어요. 놀기 → 산책에서 골라요" : "한 번 열면 계속" }),
          have ? null : el("button", { disabled: st2.disabled, onclick: () => ctx.onUnlockWalk?.(u) }, priceEl(u.price), document.createTextNode(st2.label === "사기" ? " 열기" : " " + st2.label))))));
    }
    const cards = el("div", { class: "cards" });
    for (const s of SOON) cards.append(el("div", { class: "card" }, el("canvas", { width: 56, height: 46 }), el("span", { class: "nm", text: s.name }), el("span", { class: "small dim", text: "곧 나와요" })));
    bodyEl.append(el("p", { class: "fine", text: "새 알(새 친구 9종)을 만들고 있어요." }), cards);
    for (const [i, s] of SOON.entries()) { const cv = cards.children[i].querySelector("canvas"); const c = cv.getContext("2d"); c.fillStyle = "#fbefe3"; c.fillRect(0, 0, 56, 46); const sp = SPRITES[s.id.startsWith("egg") ? "eggRainbow" : "ball"]; if (sp) drawSprite(c, sp, 20, 12, 1); c.fillStyle = "#3b2c35"; c.font = "bold 9px system-ui"; c.textAlign = "center"; c.fillText("준비 중", 28, 42); }
    return;
  }
  if (state.tab === "pick" && ctx.pet) { // 새 마음 사탕: 이번 단계 실수 지우기(별사탕, 단계마다 1번)
    const fs = forgiveState(econ, ctx.pet), m = ctx.pet.mistakes?.stage || 0;
    const have = econ.candy || 0, buyMode = fs.reason === "nocandy";
    const note = fs.ok || buyMode ? `이번 단계 돌봄 실수 ${m}개를 지워요. 다음 모습이 바뀔 수 있어요. 평생 기록은 그대로예요.`
      : fs.reason === "used" ? "이번 단계에는 이미 먹었어요. 다음 단계에 또 먹을 수 있어요."
      : fs.reason === "none" ? "이번 단계엔 지울 실수가 없어요. 잘 돌보고 있어요!"
      : fs.reason === "egg" ? "알에서 깨어나면 먹을 수 있어요."
      : "";
    bodyEl.append(el("div", { class: "banner" }, el("b", { text: `${FORGIVE.name} (가진 것 ${have}개)` }), document.createTextNode(note),
      el("div", { class: "row", style: "margin-top:8px" }, el("span", { class: "small dim", style: "flex:1", text: "매일 선물 7일째에 1개(최대 3개) · 단계마다 한 번" }),
        buyMode ? el("button", { onclick: () => ctx.onForgive?.(true) }, priceEl(FORGIVE.price), document.createTextNode(" 사서 먹이기"))
          : el("button", { disabled: !fs.ok, onclick: () => ctx.onForgive?.(false) }, document.createTextNode("먹이기")))));
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
  else if (it.price?.gem) { // 하트 보석 상품: 서버 지갑으로만(인터넷이 없으면 잠금, docs/wallet.md 2-7)
    const g = ctx.gem || {};
    const st = gemButtonState({ online: !!g.online, busy: !!g.busy, total: gems(econ), price: it.price.gem });
    if (st.poor) bar.append(el("button", { class: "ghost", text: "하트 보석 사기", onclick: () => ctx.onGoGem() }));
    bar.append(el("button", { disabled: st.disabled, onclick: () => ctx.onBuy(it) }, priceEl(it.price), document.createTextNode(" " + st.label)));
    if (st.hint) bar.querySelector(".info").append(el("div", { class: "small warn", text: st.hint }));
  } else if (it.price) {
    const ok = canAfford(econ, it.price);
    bar.append(el("button", { disabled: !ok, onclick: () => ctx.onBuy(it) }, priceEl(it.price), document.createTextNode(ok ? " 사기" : " 모자라요")));
  }
  bodyEl.append(bar);
}

function renderGemShop(box, ctx) {
  const { econ } = ctx;
  const g = ctx.gem || {};
  const closed = ctx.isApp && (g.buy || "off") === "off"; // 서버가 구글 확인(verify)·시험(test) 모드일 때만 원화 결제를 연다
  box.append(el("div", { class: "paynote" }, el("i"), document.createTextNode("초록 버튼은 진짜 돈이 나가요. 구글 결제 화면에서 한 번 더 확인해요")));
  if (ctx.isApp && g.buy === "test") box.append(el("p", { class: "warn small", text: "지금은 시험 결제 기간이에요. 테스터 계정은 구글 결제 화면에서 '테스트 카드'로 결제해 돈이 나가지 않아요. 시험으로 받은 하트 보석은 정식 출시 때 정리돼요." }));
  if (!econ.bought.starter) {
    const st = PACKS.find((p) => p.once);
    box.append(el("div", { class: "banner" }, el("b", { text: "처음 한 번만! 시작 꾸러미" }), document.createTextNode(st.desc),
      el("div", { class: "row", style: "margin-top:8px" }, el("span", { class: "small dim", style: "flex:1", text: "한 번만 살 수 있어요" }), el("button", { class: "krw", text: closed ? "준비 중" : won(st.krw), disabled: closed, onclick: () => ctx.onPack(st) }))));
  }
  for (const p of PACKS.filter((x) => !x.once)) {
    box.append(el("button", { class: "pack", disabled: closed, onclick: () => ctx.onPack(p) }, spriteCanvas("coinGem", 32, 26), el("span", { class: "g" }, document.createTextNode(p.name), el("small", { text: p.bonus || "기본" })), el("span", { class: "krw", text: closed ? "준비 중" : won(p.krw) })));
  }
  const dt = g.at ? new Date(g.at) : null;
  const seen = dt ? `${dt.getMonth() + 1}월 ${dt.getDate()}일 ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}` : null;
  box.append(el("p", { class: "fine", text: `가진 하트 보석 ${gems(econ)}개 (산 것 ${econ.gemPaid}, 받은 것 ${econ.gemFree}). 받은 것부터 먼저 써요. 하트 보석은 서버 지갑에 있고, 인터넷에 연결됐을 때만 받고 쓸 수 있어요.${seen ? ` 마지막 확인 ${seen}.` : ""}${g.pending ? ` 받을 보석 ${g.pending}개는 연결되면 들어와요.` : ""}` }));
  box.append(el("p", { class: "fine", text: "꾸미기 상품은 사기 전에 방에 미리 놓아 볼 수 있어요. 랜덤 뽑기는 없어요." }));
  if (!ctx.isApp) box.append(el("p", { class: "warn small", text: "하트 보석은 플레이스토어 앱에서 살 수 있어요(준비 중). 지금은 매일 선물과 비밀 찾기로 받을 수 있어요." }));
  box.append(el("button", { class: "big ghost", text: "구매 복원", onclick: () => ctx.onRestore() }));
  // 산 기록: 환불·문의 때 구글 주문번호(GPA.…)로 대조
  const hist = purchaseHistory(econ, 20);
  if (hist.length) {
    const nameOf = (sku) => PACKS.find((p) => p.sku === sku)?.name || "결제";
    const day = (t) => (t ? new Date(t).toLocaleString("ko-KR", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
    box.append(el("h3", { class: "sec", text: "산 기록" }), el("ul", { class: "orders" }, ...hist.map((o) =>
      el("li", {}, el("b", { text: o.sku ? nameOf(o.sku) : "결제" }), el("span", { class: "small dim", text: ` ${day(o.at)}` }), o.orderId ? el("div", { class: "small dim", text: `주문번호 ${o.orderId}` }) : null))));
    box.append(el("p", { class: "fine", text: "환불·문의 때 주문번호를 알려 주세요. 플레이 스토어 앱 → 프로필 아이콘 → 결제 및 정기 결제 → 예산 및 내역에서도 볼 수 있어요." }));
  }
  if (g.has) box.append(el("button", { class: "big ghost danger", text: "서버 지갑 지우기", onclick: () => ctx.onDeleteWallet?.() })); // 개인정보 처리방침 7번
  // 청약철회·환불 안내: 사용자 결정(2026-10-06)으로 맨 아래 접어 두고 눌러서 펼침(전자상거래법 제17조②·⑥, 콘텐츠산업 진흥법 제27조①)
  box.append(el("details", { class: "refundbox" }, el("summary", { text: "청약철회·환불 안내" }),
    el("p", { class: "small", text: "산 날부터 7일 안에는 아직 쓰지 않은 하트 보석만큼 청약철회(환불)할 수 있어요. 하트 보석은 받는 즉시 쓸 수 있는 디지털 상품이라, 이미 쓴 만큼과 시작 꾸러미로 받은 꾸미기는 철회가 제한돼요. 철회·환불 문의는 '산 기록'의 주문번호와 함께 개발자 이메일로 보내 주세요." })));
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
    stamps.append(el("div", { class: `st${done ? " done" : ""}${today ? " today" : ""}${r.gem ? " gemday" : ""}` }, document.createTextNode(`${i + 1}`), spriteCanvas(r.gem ? "coinGem" : "coinStar", 8, 8), document.createTextNode(String(r.gem || r.star) + (r.candy ? "+사탕" : ""))));
  });
  const card = el("div", { class: "dexcard" });
  const inner = el("div", { class: "dexcard-in" }, el("b", { text: status.available ? "오늘의 선물" : "오늘 선물은 받았어요" }),
    el("div", { class: "small dim", text: "하루 한 번 열어 보기만 하면 돼요. 하루 빠져도 처음으로 안 돌아가요" }), stamps);
  if (status.available) inner.append(el("button", { class: "big", text: "받기", onclick: () => { onClaim(); card.remove(); } }));
  inner.prepend(el("button", { class: "x", "aria-label": "닫기", text: "✕", onclick: () => { card.remove(); onClose?.(); } }));
  card.append(inner);
  card.addEventListener("click", (e) => { if (e.target === card) { card.remove(); onClose?.(); } });
  return card;
}
