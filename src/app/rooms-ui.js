// 방 바꾸기 화면(2026-10-09, 게임·경제·아동 심리 자문 기획): 방 위쪽 [◀ 방 이름 ▶], 이름을 누르면 방 목록.
// 선물 방: 내 방이 꽉 차면 딱 한 번 "새 방 하나를 선물할게요" 창. 시간 제한·할인·펫이 조르는 말 없음. '나중에'면 메뉴에 점만.
import { ROOMS, ROOM, UNLOCK } from "../core/catalog.js?v=5d8fb36-1791637734";
import { ownedRooms, hasRoom, switchRoom, giftReady, chooseGift, roomFull } from "../core/rooms.js?v=5d8fb36-1791637734";
import { drawWall, drawFloor } from "../render/deco.js?v=5d8fb36-1791637734";
import { josa } from "../core/josa.js?v=5d8fb36-1791637734";

const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else if (k.startsWith("on")) e[k] = v; else e.setAttribute(k, v); } for (const c of kids) if (c != null) e.append(c); return e; };
export function roomThumb(id, w = 96, h = 64) {
  const cv = el("canvas", { width: w, height: h, class: "roomthumb" }); const c = cv.getContext("2d"); c.imageSmoothingEnabled = false;
  const r = ROOM[id]; const fy = Math.round(h * 0.55);
  drawWall(c, w, fy, r.wall); c.fillStyle = "#e8a37e"; c.fillRect(0, fy - 2, w, 2); drawFloor(c, w, h, fy, r.floor);
  return cv;
}

// deps: { getProfile(), persist, say, sfx, openUnlock(u), onSwitch() } — 처음부터 다시·불러오기로 profile이 바뀌어도 따라가게 getProfile
export function makeRooms(deps) {
  const { persist, say, sfx } = deps;
  const econ = () => deps.getProfile().econ;
  const bar = document.getElementById("roombar");
  let moving = false;
  // 방 옮기기: 펫이 누른 쪽으로 콩콩 걸어 나가고 → 화면이 바뀌고 → 반대편에서 걸어 들어옴(자는 중·알이면 화면만 서서히)
  function go(id, dir = 1) {
    const e = econ(); if (e.room === id || moving) return;
    moving = true;
    const stage = document.getElementById("stage");
    const swap = () => {
      stage.classList.add("roomfade");
      setTimeout(() => {
        if (switchRoom(e, id)) { persist(); deps.onSwitch?.(); sfx("tap"); say(`${ROOM[id].name}${id === "home" ? "이에요" : "에 왔어요"}`, 2500); }
        render(); stage.classList.remove("roomfade"); deps.walkIn?.(dir); moving = false;
      }, 200);
    };
    if (deps.walkOut) deps.walkOut(dir, swap); else swap();
  }
  function step(d) { const list = ownedRooms(econ()); const i = list.indexOf(econ().room); go(list[(i + d + list.length) % list.length], d); }
  function render() {
    const e = econ(), list = ownedRooms(e);
    bar.innerHTML = "";
    const many = list.length > 1;
    if (many) bar.append(el("button", { class: "rarrow", "aria-label": "이전 방", text: "◀", onclick: () => step(-1) }));
    bar.append(el("button", { class: "rname", onclick: () => openList() }, document.createTextNode(ROOM[e.room].name), giftReady(e) ? el("i", { class: "dot" }) : null));
    if (many) bar.append(el("button", { class: "rarrow", "aria-label": "다음 방", text: "▶", onclick: () => step(1) }));
    const dot = document.getElementById("rooms-dot"); if (dot) dot.hidden = !giftReady(e);
  }
  function closeCard() { document.querySelector(".dexcard.rooms")?.remove(); }
  function openList() {
    closeCard();
    const e = econ(), gift = giftReady(e);
    const box = el("div", { class: "dexcard-in" });
    box.append(el("button", { class: "x", text: "✕", "aria-label": "닫기", onclick: closeCard }), el("h3", { text: gift ? "새 방 하나를 선물로 골라요" : "방" }));
    if (gift) box.append(el("p", { class: "small", text: "내 방이 알록달록 꽉 찼어요! 마음에 드는 방 하나를 골라요. 고른 방은 바꿀 수 없어요." }));
    const grid = el("div", { class: "roomgrid" });
    for (const r of ROOMS) {
      const mine = hasRoom(e, r.id), here = e.room === r.id, u = UNLOCK[r.unlock];
      let btn;
      if (here) btn = el("button", { class: "small", disabled: true, text: "지금 여기" });
      else if (mine) btn = el("button", { class: "small", text: "가기", onclick: () => { closeCard(); go(r.id); } });
      else if (gift) btn = el("button", { class: "small krw", text: "이 방으로 할래요", onclick: () => { if (chooseGift(e, r.id, Date.now())) { persist(); sfx("win"); closeCard(); say(`${josa(r.name, "이", "가")} 생겼어요! 위쪽 방 이름 옆 ▶를 눌러 가 봐요`, 6000); render(); } } });
      else btn = el("button", { class: "small", text: `하트 보석 ${u.price.gem}`, onclick: async () => { const ok = await deps.openUnlock(u); if (ok) { closeCard(); render(); go(r.id); } } });
      const full = mine && roomFull(e, r.id) && r.id !== "home";
      grid.append(el("div", { class: `roomcard${mine ? "" : " lock"}${here ? " on" : ""}` }, roomThumb(r.id), el("b", { text: r.name }), el("small", { text: r.desc }), full ? el("small", { class: "dim", text: "꽉 찼어요" }) : null, btn));
    }
    box.append(grid);
    if (!gift) box.append(el("p", { class: "fine", text: "방마다 벽지·바닥·가구를 따로 꾸며요. 한 물건은 한 방에만 놓을 수 있어요(다른 방에 놓으면 옮겨 와요). 머리 장식은 친구를 따라다녀요." }));
    if (gift) box.append(el("button", { class: "big ghost", text: "나중에 고를래요", onclick: () => { closeCard(); render(); } }));
    document.body.append(el("div", { class: "dexcard rooms" }, box));
  }
  // 내 방이 꽉 찼을 때 딱 한 번 선물 창(꾸미기·상점을 닫은 뒤, 다른 창이 없을 때)
  function maybeOffer(busy = () => false) {
    const e = econ();
    if (!giftReady(e) || e.roomOffered) return false;
    if (busy()) return false;
    e.roomOffered = Date.now(); persist();
    setTimeout(() => { openList(); sfx("happy"); }, 2000);
    return true;
  }
  render();
  return { render, openList, maybeOffer, go };
}
