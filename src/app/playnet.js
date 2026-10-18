// 같이 놀기(두 기기) 세션 로직. 화면 없음, 콜백만. 연결은 net.js(던전 모험에서 옮김).
// 아이 안전: 서로 주고받는 건 겉모습 카드 {key, look} 하나뿐(이름·스탯·글 없음). 방 번호는 6자리 숫자, 방장이 "들여보내기"를 눌러야 들어옴.
// 놀이방 기구 배치는 방장 것을 씀. 장면 시작은 방장 시계 기준 "지금 + 1200ms"를 두 기기가 각자 시계로 환산해 동시에 재생.
//
//   const pn = createPlayNet({ getMe: () => ({ key, look }), getEquipped: () => econ.equipped, onFriend, onShow, onState, onAsk });
//   const code = await pn.host();      // 방장: "471953"
//   await pn.join("471953");           // 친구
//   pn.answer(req.id, true);           // 방장: onAsk(req) 에 답하기 (req === null 이면 허락 창 닫기)
//   pn.startShow(round);               // 어느 쪽이든 → 양쪽 onShow({ start, round, equipped })  start = 내 기기 Date.now() 기준 시작 시각
//   pn.leave();
//
// 메시지(작게): me {t:"me",k,s,c,m,o} / 시계 맞추기 {t:"tq",a} → {t:"ts",a,h} / 친구가 시작 요청 {t:"want",r} / 시작 {t:"go",at,r,e:[L,M,R]}
import { NetSession, NET_CODE_LEN } from "./net.js?v=7fbf949-1792323726";
import { VISIT_KEYS } from "../core/visit.js?v=7fbf949-1792323726";
import { ITEM } from "../core/catalog.js?v=7fbf949-1792323726";

export const SHOW_LEAD_MS = 1200;          // 누르고 이만큼 뒤에 시작
const SPOTS = ["p", "g", "b", "y", "v", "r", "Y"];
const SPOT6 = ["p", "g", "b", "y", "v", "r"];
const CHUB_MIN = 1, CHUB_MAX = 1.25;
const PLAY_SLOTS = ["playL", "playM", "playR"];
const MAX_ROUND = 9999;
const SYNC_SAMPLES = 4, SYNC_GAP = 250, SYNC_EVERY = 15000;

const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);

// ----- 겉모습 카드: 보낼 때 줄이고, 받을 때 검사해서 되살려요 -----
export function packCard(key, look = {}) {
  if (!VISIT_KEYS.includes(key)) return null;
  const s = SPOTS.includes(look.spot) ? look.spot : "p";
  const chub = Number.isFinite(look.chub) ? Math.max(CHUB_MIN, Math.min(CHUB_MAX, look.chub)) : 1;
  return { t: "me", k: key, s, c: Math.round(chub * 100) / 100, m: look.messy ? 1 : 0, o: look.chosen ? 1 : 0 };
}
export function readCard(d) {
  if (!isObj(d) || d.t !== "me") return null;
  if (typeof d.k !== "string" || !VISIT_KEYS.includes(d.k)) return null;
  if (typeof d.s !== "string" || !SPOTS.includes(d.s)) return null;
  if (typeof d.c !== "number" || !Number.isFinite(d.c) || d.c < CHUB_MIN || d.c > CHUB_MAX) return null;
  if (d.m !== 0 && d.m !== 1) return null;
  if (d.o !== 0 && d.o !== 1) return null;
  const spot = d.s;
  return {
    key: d.k,
    look: { spot, chosen: d.o === 1, spot2: spot === "Y" ? "y" : SPOT6[(SPOT6.indexOf(spot) + 2) % SPOT6.length], chub: d.c, messy: d.m === 1 },
  };
}
// 놀이방 기구: 그 칸의 알려진 상품만(아니면 빈칸)
export function packEquip(eq) {
  const e = isObj(eq) ? eq : {};
  return PLAY_SLOTS.map((s) => (typeof e[s] === "string" && ITEM[e[s]]?.slot === s ? e[s] : null));
}
export function readEquip(a) {
  if (!Array.isArray(a) || a.length !== PLAY_SLOTS.length) return null;
  const out = {};
  for (let i = 0; i < PLAY_SLOTS.length; i++) {
    const id = a[i];
    if (id === null) continue;
    if (typeof id !== "string" || ITEM[id]?.slot !== PLAY_SLOTS[i]) return null;
    out[PLAY_SLOTS[i]] = id;
  }
  return out;
}
const okRound = (r) => Number.isInteger(r) && r >= 0 && r <= MAX_ROUND;

const STATE = {
  hosting: (c) => `방 번호 ${c.slice(0, 3)} ${c.slice(3)} · 친구가 이 숫자를 넣으면 같이 놀 수 있어요`,
  ask: () => "친구가 놀러 오고 싶대요. 들여보낼까요?",
  joining: () => "친구 방을 찾고 있어요",
  waiting: () => "방장 친구가 들여보내 주기를 기다려요",
  together: () => "친구랑 연결됐어요! 같이 놀아요",
  gone: () => "친구가 집에 갔어요",
  goneHost: () => "친구가 집에 갔어요. 다른 친구를 기다려요",
  bye: () => "같이 놀기를 끝냈어요",
};

export function createPlayNet(opts = {}) {
  const s = opts.session || new NetSession();
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  const cb = (name, ...a) => { const f = opts[name]; if (typeof f === "function") { try { f(...a); } catch (e) { console.error(e); } } };
  const state = (text) => cb("onState", text);
  const friendSlot = () => (s.role === "host" ? [...s.peers.keys()][0] : s.role === "guest" ? 1 : null);

  let friend = null;
  let sync = { offset: 0, rtt: Infinity, n: 0 }; // 친구: 방장 시계 - 내 시계
  let syncTimers = [];
  let lastStart = 0;  // 방장: 마지막 장면 시작 시각(방장 시계). 카운트다운 중엔 다시 안 받아요
  let lastAsk = null;
  let quietLost = false; // 친구(손님)가 방장이 나간 걸 알았으면 "연결이 끊겼어요"는 한 번 건너뛰어요

  const setFriend = (f) => {
    const was = friend;
    friend = f;
    if (was === f) return;
    cb("onFriend", f);
  };
  const myCard = () => {
    let me = null;
    try { me = opts.getMe ? opts.getMe() : null; } catch (e) { me = null; }
    return me ? packCard(me.key, me.look) : null;
  };
  const myEquip = () => {
    let eq = null;
    try { eq = opts.getEquipped ? opts.getEquipped() : opts.getMe?.()?.equipped; } catch (e) { eq = null; }
    return packEquip(eq);
  };
  const sendCard = () => {
    const slot = friendSlot(), card = myCard();
    if (slot != null && card) s.send(slot, card);
  };

  // ----- 시계 맞추기 (친구 쪽에서 방장에게 묻기) -----
  const stopSync = () => { for (const t of syncTimers) { clearTimeout(t); clearInterval(t); } syncTimers = []; };
  const unref = (t) => { if (t && typeof t.unref === "function") t.unref(); return t; };
  const askTime = () => { if (s.role === "guest") s.toHost({ t: "tq", a: now() }); };
  const startSync = () => {
    stopSync();
    sync = { offset: 0, rtt: Infinity, n: 0 };
    for (let i = 0; i < SYNC_SAMPLES; i++) syncTimers.push(unref(setTimeout(askTime, i * SYNC_GAP)));
    syncTimers.push(unref(setInterval(askTime, SYNC_EVERY)));
  };
  const onTime = (d) => {
    if (!Number.isFinite(d.a) || !Number.isFinite(d.h)) return;
    const b = now(), rtt = b - d.a;
    if (rtt < 0 || rtt > 30000) return; // 내가 보낸 게 아님
    const off = d.h + rtt / 2 - b;
    // 왕복이 가장 짧았던 표본이 가장 정확해요. 오래되면(새로 잴 때) 조금 더 긴 것도 받아요
    if (rtt <= sync.rtt || sync.n >= SYNC_SAMPLES) { sync.offset = off; sync.rtt = rtt; }
    sync.n++;
  };

  // ----- 장면 시작 -----
  const hostGo = (round) => {
    const t = now();
    if (t < lastStart) return false; // 이미 카운트다운 중
    const at = t + SHOW_LEAD_MS, e = myEquip();
    lastStart = at;
    const slot = friendSlot();
    if (slot != null) s.send(slot, { t: "go", at, r: round, e });
    cb("onShow", { start: at, round, equipped: readEquip(e) || {} });
    return true;
  };

  // ----- 받은 메시지 -----
  s.on("message", (d, slot) => {
    if (!isObj(d) || typeof d.t !== "string") return;
    if (slot !== friendSlot()) return;
    switch (d.t) {
      case "me": {
        const f = readCard(d); if (!f) return; // 모르는 모습·범위 밖 값은 무시
        const first = !friend;
        setFriend(f);
        if (first) sendCard(); // 처음 받으면 내 카드도 한 번 더(연결 직후 앞 메시지가 엇갈려도 서로 꼭 받게)
        return;
      }
      case "tq": if (s.role === "host" && Number.isFinite(d.a)) s.send(slot, { t: "ts", a: d.a, h: now() }); return;
      case "ts": if (s.role === "guest") onTime(d); return;
      case "want": if (s.role === "host" && friend && okRound(d.r)) hostGo(d.r); return;
      case "go": {
        if (s.role !== "guest" || !Number.isFinite(d.at) || !okRound(d.r)) return;
        const eq = readEquip(d.e); if (!eq) return;
        cb("onShow", { start: Math.round(d.at - sync.offset), round: d.r, equipped: eq });
        return;
      }
      default: return;
    }
  });
  // 방장: 새 친구 허락 (이름 없이 번호만)
  s.on("ask", (req) => { lastAsk = { id: req.id }; state(STATE.ask()); cb("onAsk", lastAsk); });
  s.on("askEnd", () => { if (lastAsk) { lastAsk = null; cb("onAsk", null); } });
  s.on("join", () => { state(STATE.together()); sendCard(); });
  s.on("waiting", () => state(STATE.waiting()));
  s.on("leave", () => {
    setFriend(null);
    if (s.role === "host") state(STATE.goneHost());
    else if (s.role === "guest") { quietLost = true; state(STATE.gone()); }
  });
  s.on("error", (err) => {
    if (err && err.code === "lost" && quietLost) { quietLost = false; return; }
    if (err && err.text) state(err.text);
  });
  s.on("close", () => { stopSync(); setFriend(null); });

  const api = {
    async host() {
      setFriend(null); stopSync(); lastStart = 0; quietLost = false;
      const code = await s.host();
      state(STATE.hosting(code));
      return code;
    },
    async join(code) {
      setFriend(null); stopSync(); quietLost = false;
      state(STATE.joining());
      const c = String(code ?? "").replace(/\D/g, "").slice(0, NET_CODE_LEN);
      const slot = await s.join(c);
      state(STATE.together());
      startSync();
      sendCard();
      return slot;
    },
    answer(id, yes) { return s.role === "host" ? s.answer(id, !!yes) : false; },
    // 어느 쪽이든: 방장이면 바로 시작 시각을 정하고, 친구면 방장에게 부탁해요
    startShow(round = 0) {
      const r = Number.isInteger(round) ? Math.max(0, Math.min(MAX_ROUND, round)) : 0;
      if (!friend) return false;
      if (s.role === "host") return hostGo(r);
      if (s.role === "guest") return s.toHost({ t: "want", r });
      return false;
    },
    leave() {
      const had = !!s.role;
      stopSync();
      s.leave();
      setFriend(null);
      if (had) state(STATE.bye());
    },
    // 겉모습이 바뀌었을 때(자라기 등) 다시 보내기
    refresh() { sendCard(); },
    get friend() { return friend; },
    get role() { return s.role; },
    get code() { return s.code; },
    get session() { return s; },
    get clockOffset() { return sync.offset; },
  };
  return api;
}
