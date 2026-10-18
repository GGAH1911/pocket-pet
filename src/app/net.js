// ===== 같이 놀기: 연결만 하는 파일 (게임 로직 없음) =====
// 출처: 던전 모험(dungeon-adventure) src/net.js 를 ES 모듈로 옮김(2026-10). 로직은 그대로, 바꾼 것만:
//   아이디 앞글자 almo- / 빌드 almochi-play-1 / 최대 2명(방장 + 친구 1) / PeerJS 경로 = 이 모듈 기준 ../vendor/peerjs.min.js
//   / 탭 시험 채널 almo-net / 정리 타이머는 node 시험이 기다리지 않게 unref.
// 이름(닉네임)은 보내지도 보이지도 않아요(info 는 비워 둠). 알모찌 놀이 로직은 playnet.js.
//
// 쓰는 법
//   import { Net, NetSession } from "./net.js?v=f8bf84f-1792288456";
//   const s = Net;                       // 기본 세션 (new NetSession() 으로 더 만들 수도 있어요: 시험용)
//   const code = await s.host();         // 방 만들기 -> "471953" (6자리, crypto 난수)
//   await s.join("471953");              // 방 들어가기
//   s.on("ask", (req) => s.answer(req.id, true/false))  // 새 친구 들여보낼까요? (방장만, 30초 안에)
//   s.autoApprove = true / s.locked = true               // 시험용 자동 허락 / 방 잠그기
//   s.on("join", (slot, info) => ...)    // 친구가 들어옴 (방장만, 허락한 뒤)
//   s.on("leave", (slot, why) => ...)    // 친구가 나감 / 방장이 끊김(slot 1)
//   s.on("message", (msg, fromSlot) => ...)
//   s.on("rtt", (slot, ms) => ...)       // 2초마다 왕복 시간
//   s.on("error", (err) => ...)          // err = { code, text } (아이 친화 문구)
//   s.send(slot, msg) / s.broadcast(msg) / s.toHost(msg)
//   s.sendFast(...)                      // 상태 스냅샷용 빠른 길(순서·재전송 없음). 없으면 보통 길로
//   s.leave()
//
// 연결 방법(transport)
//   "peer"      : PeerJS 무료 공용 서버로 처음 인사 → 그 뒤 기기끼리 직접 (기본)
//   "broadcast" : 같은 브라우저 두 탭 (BroadcastChannel) - 시험용
//   "loopback"  : 같은 JS 안 두 세션 - smoke 시험용 (NetLoopback)
//
// PeerJS 는 같이 하기를 누를 때만 불러와요 (혼자 할 때·인터넷 없을 때 게임에 영향 없음).

const NET_PROTOCOL = 1;          // 메시지 규칙 버전 (바꾸면 서로 다른 버전끼리 못 붙어요)
const NET_BUILD = "almochi-play-1"; // 게임 빌드 (같이 놀기 규칙이 바뀌면 올려요. 다르면 못 붙어요)
const NET_ID_PREFIX = "almo-";   // PeerJS 아이디 = almo-471953
const NET_CODE_LEN = 6;          // 방 번호 자리 수
const NET_HI_TIMEOUT = 5000;     // 연결하고 이 안에 인사(hi)가 없으면 끊어요
const NET_MAX_WAITING = 4;       // 인사 기다리는 연결 최대 수
const NET_ASK_TIMEOUT = 30000;   // 방장이 이 안에 "예"를 안 누르면 끊어요
const NET_RATE = 80;             // 연결 하나가 1초에 보낼 수 있는 메시지 수 (넘으면 끊어요)
const NET_BURST = 160;           // 잠깐 몰려도 되는 양
const NET_PART_MAX = 64;         // 조각 수 최대
const NET_PART_BUFS = 4;         // 다 못 모은 조각 묶음 최대 (넘으면 오래된 것부터 버려요)
const NET_MAX_PLAYERS = 2;       // 방장 1 + 친구 1
const NET_JOIN_TIMEOUT = 15000;  // 들어가기 시간 제한 (ms)
const NET_PING_EVERY = 2000;
const NET_LOST_AFTER = 9000;     // 이만큼 아무 소식이 없으면 끊긴 걸로
const NET_PART_SIZE = 15000;     // PeerJS json 한 메시지 한계(16300바이트)보다 조금 작게

const NET_TEXT = {
  "no-room": (c) => `방 번호 ${c || ""}번을 찾을 수 없어요. 방장 화면의 숫자를 다시 봐요`,
  offline: () => "연결 도우미에 닿지 않아요. 인터넷(Wi-Fi)이 켜져 있는지 확인해요",
  timeout: () => "연결이 너무 오래 걸려요. 두 기기가 같은 Wi-Fi인지, 손님용 Wi-Fi가 아닌지 확인해요",
  full: () => "방에 벌써 친구가 있어요 (둘이서만 놀 수 있어요)",
  lib: () => "같이 놀기 준비물을 못 불러왔어요. 인터넷을 확인하고 다시 해봐요",
  browser: () => "이 브라우저는 같이 놀기를 못 해요. 크롬으로 열어요",
  version: () => "알모찌 버전이 달라요. 둘 다 최신으로 업데이트해요",
  locked: () => "방이 잠겨 있어요. 방장에게 열어 달라고 해요",
  denied: () => "방장이 들여보내 주지 않았어요",
  later: () => "방장이 다른 친구를 받는 중이에요. 조금 뒤에 다시 해봐요",
  lost: () => "연결이 끊겼어요",
  busy: () => "방 번호를 만들지 못했어요. 다시 해봐요",
};
function netError(code, extra) {
  const f = NET_TEXT[code] || NET_TEXT.lost;
  return { code, text: f(extra) };
}

// ----- PeerJS 불러오기 (한 번만) -----
// 이 모듈 주소 기준 ../vendor/peerjs.min.js (모듈 주소에 ?v= 가 붙어 있으면 그대로 붙여요)
// PeerJS 는 UMD 라 보통 <script> 로 넣으면 window.Peer 가 생겨요
const NET_LIB_URL = (() => {
  try {
    const me = new URL(import.meta.url);
    const u = new URL("../vendor/peerjs.min.js", me);
    u.search = me.search;
    return u.href;
  } catch (e) { return "src/vendor/peerjs.min.js"; }
})();
const netHasPeer = () => typeof globalThis.Peer === "function";
let netLibPromise = null;
function netLoadPeerLib() {
  if (netHasPeer()) return Promise.resolve();
  if (netLibPromise) return netLibPromise;
  netLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = NET_LIB_URL;
    s.async = true;
    s.onload = () => (netHasPeer() ? resolve() : reject(netError("lib")));
    s.onerror = () => { netLibPromise = null; reject(netError("lib")); };
    document.head.appendChild(s);
  });
  return netLibPromise;
}

const netLater = (fn) => Promise.resolve().then(fn);
// 정리(sweep)용 타이머: node 시험에서는 이 타이머 때문에 끝나기를 기다리지 않게 unref (브라우저는 숫자라 그대로)
function netTimer(fn, ms) {
  if (typeof setTimeout !== "function") return null;
  const t = setTimeout(fn, ms);
  if (t && typeof t.unref === "function") t.unref();
  return t;
}

// ===== 연결 방법 1: PeerJS =====
// 연결(conn) 공통 모양: { remote, open, send(obj), onData(fn), onClose(fn), close(), pc, fast? }
const netEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
function netByteLen(str) { return netEncoder ? netEncoder.encode(str).length : str.length * 3; }
function netWrapPeerConn(c) {
  const conn = { remote: c.peer, open: c.open, kind: (c.metadata && c.metadata.kind) || "main", _data: [], _close: [], raw: c };
  Object.defineProperty(conn, "pc", { get: () => c.peerConnection });
  // PeerJS "json" 연결은 한 메시지가 16300바이트를 넘으면 오류를 내고 연결을 끊어요 -> 큰 메시지는 조각내서 보내요
  let partSeq = 0;
  conn.send = (obj) => {
    if (!c.open) return;
    const str = JSON.stringify(obj);
    if (str.length * 3 < NET_PART_SIZE || netByteLen(str) < NET_PART_SIZE) { c.send(obj); return; }
    const id = ++partSeq, step = Math.floor(NET_PART_SIZE / 3), n = Math.ceil(str.length / step); // 한글은 UTF-8 로 3바이트까지
    for (let i = 0; i < n; i++) c.send({ _n: "part", id, i, n, s: str.slice(i * step, (i + 1) * step) });
  };
  // 받은 조각: 모양을 꼼꼼히 보고, 이상하면 연결을 끊어요 (아주 큰 번호로 메모리를 채우는 장난 막기)
  const parts = new Map(); // id -> { n, got, a }  (넣은 순서 = 오래된 순서)
  const step = Math.floor(NET_PART_SIZE / 3);
  const bad = () => { parts.clear(); conn.close(); };
  const deliver = (d) => {
    if (closed) return;
    if (d && d._n === "part") {
      const { id, i, n, s } = d;
      if (!Number.isInteger(id) || !Number.isInteger(n) || !Number.isInteger(i) || n < 2 || n > NET_PART_MAX || i < 0 || i >= n || typeof s !== "string" || s.length > step) return bad();
      let b = parts.get(id);
      if (b && b.n !== n) return bad();
      if (!b) {
        b = { n, got: 0, a: new Array(n) };
        parts.set(id, b);
        while (parts.size > NET_PART_BUFS) parts.delete(parts.keys().next().value);
      }
      if (b.a[i] === undefined) b.got++;
      b.a[i] = s;
      if (b.got < n) return;
      parts.delete(id);
      try { d = JSON.parse(b.a.join("")); } catch (e) { return bad(); }
    }
    for (const f of conn._data) f(d);
  };
  conn.onData = (fn) => conn._data.push(fn);
  conn.onClose = (fn) => conn._close.push(fn);
  let closed = false;
  const fireClose = (why) => { if (closed) return; closed = true; conn.open = false; for (const f of conn._close) f(why); };
  conn.close = () => { try { c.close(); } catch (e) { /* 무시 */ } fireClose("closed"); };
  c.on("open", () => { conn.open = true; });
  c.on("data", deliver);
  c.on("close", () => fireClose("closed"));
  c.on("error", () => fireClose("error"));
  return conn;
}

// 중계(TURN) 접속 정보: Cloudflare Worker(server/turn-worker.js)가 2시간짜리를 만들어 줘요.
//   기기끼리 바로 못 붙을 때(휴대폰 데이터·회사/학교 Wi-Fi 등)만 중계를 거쳐요. 받기 실패하면 예전처럼 STUN 만 (같이 하기는 그대로 돼요)
//   진단: 주소에 ?relay=1 을 붙이면 중계로만 연결해요 (중계가 되는지 시험)
const NET_ICE_URL = "https://da-turn.hwangi0404.workers.dev/ice";
const NET_STUN = [{ urls: "stun:stun.cloudflare.com:3478" }, { urls: "stun:stun.l.google.com:19302" }];
const netIce = { list: null, at: 0, ttl: 0, pending: null };
function netRelayOnly() { try { return typeof location !== "undefined" && /[?&]relay=1\b/.test(location.search); } catch (e) { return false; } }
async function netIceServers() {
  const now = Date.now();
  if (netIce.list && now - netIce.at < Math.max(60000, (netIce.ttl - 600) * 1000)) return netIce.list;
  if (typeof fetch !== "function" || typeof location === "undefined" || !/^https?:/.test(location.protocol)) return NET_STUN; // 시험 환경
  if (!netIce.pending) netIce.pending = (async () => {
    try {
      const ctl = typeof AbortController === "function" ? new AbortController() : null;
      const to = setTimeout(() => ctl && ctl.abort(), 3000); // 3초 안에 못 받으면 중계 없이
      const r = await fetch(NET_ICE_URL, { signal: ctl ? ctl.signal : undefined, cache: "no-store" });
      clearTimeout(to);
      const j = r.ok ? await r.json() : null;
      if (j && Array.isArray(j.iceServers) && j.iceServers.length) { netIce.list = [...NET_STUN, ...j.iceServers.filter((x) => x && x.username)]; netIce.at = Date.now(); netIce.ttl = j.ttl || 3600; }
    } catch (e) { /* 중계 없이 */ }
    netIce.pending = null;
    return netIce.list || NET_STUN;
  })();
  return netIce.pending;
}

class NetPeerTransport {
  constructor(opts = {}) { this.opts = opts; this.peer = null; this.ice = null; }
  peerOptions() {
    const config = { iceServers: this.opts.iceServers || this.ice || NET_STUN };
    if (this.opts.relayOnly || netRelayOnly()) config.iceTransportPolicy = "relay";
    return { debug: 0, config };
  }
  async start(id) {
    await netLoadPeerLib();
    if (!this.opts.iceServers) this.ice = await netIceServers();
    if (typeof RTCPeerConnection === "undefined") throw netError("browser");
    return new Promise((resolve, reject) => {
      const Peer = globalThis.Peer; // 불러온 뒤 생긴 전역 Peer
      const peer = id ? new Peer(id, this.peerOptions()) : new Peer(this.peerOptions());
      this.peer = peer;
      let opened = false;
      peer.on("open", () => { opened = true; resolve(peer.id); });
      peer.on("error", (e) => {
        const t = e && e.type;
        if (!opened) {
          if (t === "unavailable-id") reject({ code: "taken" });
          else if (t === "browser-incompatible") reject(netError("browser"));
          else reject(netError("offline"));
          return;
        }
        if (this.onPeerError) this.onPeerError(t, e);
      });
    });
  }
  // 방장: 들어오는 연결 받기
  listen(id, onConn) {
    return this.start(id).then(() => {
      this.peer.on("connection", (c) => {
        // 우리 게임은 json 으로만 이야기해요. 다른 방식(binary 등)은 바로 끊어요
        if (c.serialization !== "json") { try { c.close(); } catch (e) { /* 무시 */ } return; }
        onConn(netWrapPeerConn(c));
      });
    });
  }
  // 친구: 방장에게 연결
  async connect(id, opts = {}) {
    if (!this.peer) await this.start(null);
    return new Promise((resolve, reject) => {
      const c = this.peer.connect(id, { reliable: opts.kind !== "fast", serialization: "json", metadata: { kind: opts.kind || "main" }, label: opts.kind || "main" });
      const conn = netWrapPeerConn(c);
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; reject(netError("timeout")); } }, opts.timeout || NET_JOIN_TIMEOUT);
      this.onPeerError = (t) => { if (!done && t === "peer-unavailable") { done = true; clearTimeout(timer); reject(netError("no-room", id.replace(NET_ID_PREFIX, ""))); } };
      c.on("open", () => { if (done) return; done = true; clearTimeout(timer); conn.open = true; resolve(conn); });
    });
  }
  destroy() { try { if (this.peer) this.peer.destroy(); } catch (e) { /* 무시 */ } this.peer = null; }
}

// ===== 연결 방법 2: 같은 JS 안 (smoke 시험) =====
const NetLoopback = {
  servers: new Map(),
  delay: 0, // ms (0 이면 바로 다음 마이크로태스크)
  pair(aId, bId) {
    const mk = (remote) => ({ remote, open: true, kind: "main", _data: [], _close: [], pc: null });
    const a = mk(bId), b = mk(aId);
    const deliver = (to, d) => {
      const copy = JSON.parse(JSON.stringify(d)); // 실제처럼 복사해서 보내요
      const go = () => { if (to.open) for (const f of to._data) f(copy); };
      if (NetLoopback.delay > 0) setTimeout(go, NetLoopback.delay); else netLater(go);
    };
    for (const [me, other] of [[a, b], [b, a]]) {
      me.send = (d) => { if (me.open) deliver(other, d); };
      me.onData = (fn) => me._data.push(fn);
      me.onClose = (fn) => me._close.push(fn);
      me.close = () => {
        for (const x of [me, other]) { if (!x.open) continue; x.open = false; const fs = x._close.slice(); netLater(() => fs.forEach((f) => f("closed"))); }
      };
    }
    return [a, b];
  },
};
let netLoopSeq = 0;
class NetLoopTransport {
  constructor() { this.id = null; }
  async listen(id, onConn) {
    if (NetLoopback.servers.has(id)) throw { code: "taken" };
    this.id = id; NetLoopback.servers.set(id, onConn);
  }
  async connect(id) {
    const onConn = NetLoopback.servers.get(id);
    if (!onConn) throw netError("no-room", id.replace(NET_ID_PREFIX, ""));
    this.id = this.id || "guest-" + (++netLoopSeq) + "-" + Math.random().toString(36).slice(2, 8); // 게임마다 따로 세도 겹치지 않게
    const [mine, theirs] = NetLoopback.pair(this.id, id);
    netLater(() => onConn(theirs));
    return mine;
  }
  destroy() { if (this.id && NetLoopback.servers.get(this.id)) NetLoopback.servers.delete(this.id); }
}

// ===== 연결 방법 3: 같은 브라우저 두 탭 (BroadcastChannel) =====
class NetTabTransport {
  constructor() {
    this.id = null; this.ch = null; this.conns = new Map(); this.onConn = null; this.waiters = new Map();
  }
  chan() {
    if (this.ch) return this.ch;
    if (typeof BroadcastChannel === "undefined") throw netError("browser");
    this.ch = new BroadcastChannel("almo-net");
    this.ch.onmessage = (e) => this.onMsg(e.data);
    return this.ch;
  }
  post(m) { this.chan().postMessage({ ...m, from: this.id }); }
  makeConn(remote, cid) {
    const conn = { remote, cid, open: true, kind: "main", _data: [], _close: [], pc: null };
    conn.send = (d) => { if (conn.open) this.post({ k: "data", to: remote, cid, d }); };
    conn.onData = (fn) => conn._data.push(fn);
    conn.onClose = (fn) => conn._close.push(fn);
    conn.close = () => { if (!conn.open) return; this.post({ k: "close", to: remote, cid }); this.dropConn(cid); };
    this.conns.set(cid, conn);
    return conn;
  }
  dropConn(cid) {
    const c = this.conns.get(cid);
    if (!c || !c.open) return;
    c.open = false; this.conns.delete(cid);
    for (const f of c._close) f("closed");
  }
  onMsg(m) {
    if (m.to && m.to !== this.id) return;
    if (m.k === "who" && m.id === this.id && this.onConn) this.post({ k: "here", to: m.from });
    else if (m.k === "here") { const w = this.waiters.get("who"); if (w) w(); }
    else if (m.k === "conn" && this.onConn) { const c = this.makeConn(m.from, m.cid); this.post({ k: "accept", to: m.from, cid: m.cid }); this.onConn(c); }
    else if (m.k === "accept") { const w = this.waiters.get(m.cid); if (w) w(); }
    else if (m.k === "data") { const c = this.conns.get(m.cid); if (c && c.open) for (const f of c._data) f(m.d); }
    else if (m.k === "close") this.dropConn(m.cid);
  }
  async listen(id, onConn) {
    this.id = id; this.chan();
    // 같은 번호 방이 이미 있는지 물어봐요
    const taken = await new Promise((res) => { this.waiters.set("who", () => res(true)); this.post({ k: "who", id }); setTimeout(() => res(false), 250); });
    this.waiters.delete("who");
    if (taken) throw { code: "taken" };
    this.onConn = onConn;
  }
  async connect(id) {
    this.id = this.id || "tab-" + Math.random().toString(36).slice(2, 8); this.chan();
    const cid = this.id + "-" + Date.now();
    await new Promise((res, rej) => {
      this.waiters.set(cid, res);
      this.post({ k: "conn", to: id, cid });
      setTimeout(() => rej(netError("no-room", id.replace(NET_ID_PREFIX, ""))), 1500);
    });
    this.waiters.delete(cid);
    return this.makeConn(id, cid);
  }
  destroy() { for (const cid of [...this.conns.keys()]) { const c = this.conns.get(cid); if (c) c.close(); } if (this.ch) this.ch.close(); this.ch = null; }
}

// ===== 세션: 방장/친구, 자리 번호, 핑, 메시지 =====
class NetSession {
  constructor(opts = {}) {
    this.opts = opts;
    this.transportName = opts.transport || "peer";
    this.role = null;          // "host" | "guest"
    this.code = null;          // 방 번호 "4719"
    this.slot = 0;             // 내 자리 (방장 1, 친구 2~4)
    this.peers = new Map();    // 방장: 자리 -> { conn, fast, info, lastSeen, rtt } / 친구: 1 -> 방장
    this.handlers = {};
    this.rtt = {};             // 자리 -> 최근 왕복 ms
    this.stats = { sent: 0, recv: 0, bytesSent: 0, bytesRecv: 0 };
    this.timer = null;
    this.info = {};            // 알모찌: 이름 등 아무것도 안 보내요 (opts.info 무시)
    this.autoApprove = !!opts.autoApprove; // 시험용: 새 친구를 묻지 않고 들여보내요
    this.locked = false;       // 방 잠그기: 새 친구를 받지 않아요
    this.waiting = new Map();  // 방장: 인사(hi) 기다리는 연결 -> 연결된 때
    this.pending = [];         // 방장: 허락 기다리는 친구 [{ id, conn, info, t0 }] (보여주는 것 1 + 줄 1)
    this.askSeq = 0;
    this.closing = new Map();  // 방장: "안 돼요" 를 보낸 뒤 곧 끊을 연결
  }
  get asking() { return this.pending[0] || null; }
  now() { return Date.now(); }
  // 연결 하나당 1초에 NET_RATE 개 (토큰 통). 넘치면 false
  rateOk(conn, now = this.now()) {
    if (this.opts.rate === 0) return true;
    const rate = this.opts.rate || NET_RATE, burst = rate * (NET_BURST / NET_RATE);
    if (conn._tokT === undefined) { conn._tok = burst; conn._tokT = now; }
    conn._tok = Math.min(burst, conn._tok + (now - conn._tokT) * rate / 1000); conn._tokT = now;
    if (conn._tok < 1) return false;
    conn._tok -= 1;
    return true;
  }
  // 너무 많이 보내는 연결은 끊어요
  flood(conn) {
    if (conn._flood) return; conn._flood = true;
    if (conn._slot && this.peers.get(conn._slot) && this.peers.get(conn._slot).conn === conn) this.dropPeer(conn._slot, "flood");
    else if (this.role === "guest" && this.peers.get(1) && (this.peers.get(1).conn === conn || this.peers.get(1).fast === conn)) this.dropPeer(1, "flood");
    else { this.forget(conn); try { conn.close(); } catch (e) { /* 무시 */ } }
  }
  on(name, fn) { (this.handlers[name] = this.handlers[name] || []).push(fn); return this; }
  off(name, fn) { const l = this.handlers[name]; if (l) this.handlers[name] = l.filter((f) => f !== fn); }
  emit(name, ...a) { for (const f of this.handlers[name] || []) { try { f(...a); } catch (e) { console.error(e); } } }
  get connected() { return this.role === "host" ? true : this.peers.size > 0; }
  get count() { return this.role === "host" ? 1 + this.peers.size : this.role === "guest" ? this.lastCount || 2 : 1; }

  makeTransport() {
    if (this.transportName === "loopback") return new NetLoopTransport();
    if (this.transportName === "broadcast") return new NetTabTransport();
    return new NetPeerTransport(this.opts);
  }

  // ----- 방 만들기 -----
  async host() {
    this.leave(true);
    for (let tries = 0; tries < 6; tries++) {
      const code = this.opts.fixedCode || netRoomCode();
      const t = this.makeTransport();
      try {
        await t.listen(NET_ID_PREFIX + code, (conn) => this.acceptConn(conn));
        this.transport = t; this.role = "host"; this.code = code; this.slot = 1;
        this.startPing();
        this.emit("open", { role: "host", code, slot: 1 });
        return code;
      } catch (e) {
        t.destroy && t.destroy();
        if (e && e.code === "taken" && !this.opts.fixedCode) continue;
        const err = e && e.text ? e : netError(e && e.code === "taken" ? "busy" : "offline");
        this.emit("error", err); throw err;
      }
    }
    const err = netError("busy"); this.emit("error", err); throw err;
  }

  // 방장: 새 연결 받기 (첫 메시지 hi 를 기다렸다가, 방장이 "예"를 누르면 자리를 줘요)
  acceptConn(conn) {
    const remote = conn.remote;
    const owner = () => [...this.peers.values()].find((x) => x.remote === remote);
    if (conn.kind === "fast") {
      // 빠른 길: 이미 자리를 받은 친구의 것만 붙여요. 아니면 끊어요
      const p0 = owner();
      if (!p0 || (p0.fast && p0.fast.open)) { try { conn.close(); } catch (e) { /* 무시 */ } return; }
      p0.fast = conn; conn.onClose(() => { if (p0.fast === conn) p0.fast = null; });
      conn.onData((d) => {
        if (!this.rateOk(conn)) return this.flood(conn);
        const p = owner(); if (p && p.fast === conn) this.onData(p.slot, d); else { try { conn.close(); } catch (e) { /* 무시 */ } }
      });
      return;
    }
    // 이미 자리를 받은 친구가 보통 연결을 또 열면 끊어요
    if (owner()) { try { conn.close(); } catch (e) { /* 무시 */ } return; }
    // 인사 기다리는 연결이 너무 많으면 끊어요
    if (this.waiting.size >= NET_MAX_WAITING) { try { conn.close(); } catch (e) { /* 무시 */ } return; }
    this.waiting.set(conn, this.now());
    netTimer(() => this.sweep(), NET_HI_TIMEOUT + 50);
    conn.onData((d) => {
      if (!this.rateOk(conn)) return this.flood(conn);
      if (conn._slot) return this.onData(conn._slot, d);
      if (d && d._n === "hi" && this.waiting.has(conn)) return this.onHello(conn, d);
      // 자리 받기 전에는 hi 말고는 듣지 않아요
    });
    conn.onClose(() => { this.forget(conn); if (conn._slot) this.dropPeer(conn._slot, "closed"); });
  }
  refuse(conn, code) {
    this.forget(conn);
    try { conn.send({ _n: "reject", code }); } catch (e) { /* 무시 */ }
    // "안 돼요" 가 먼저 닿게 조금 뒤에 끊어요 (타이머 또는 다음 sweep)
    conn._refused = true; this.closing.set(conn, this.now());
    netTimer(() => this.sweep(), 300);
  }
  // 기다리는 줄에서 빼요 (허락 창이 바뀌면 알려요)
  forget(conn) {
    this.waiting.delete(conn);
    const i = this.pending.findIndex((r) => r.conn === conn);
    if (i < 0) return;
    this.pending.splice(i, 1);
    if (i === 0) { this.emit("askEnd"); if (this.pending[0]) this.emit("ask", this.pending[0]); }
  }
  onHello(conn, d) {
    this.waiting.delete(conn);
    if (d.ver !== NET_PROTOCOL || d.build !== NET_BUILD) return this.refuse(conn, "version");
    if (this.locked) return this.refuse(conn, "locked");
    if (1 + this.peers.size >= NET_MAX_PLAYERS) return this.refuse(conn, "full");
    const info = {}; // 알모찌: 친구가 보낸 info(이름 등)는 받지도 보여주지도 않아요
    if (this.autoApprove) return this.admit(conn, info);
    if (this.pending.length >= 2) return this.refuse(conn, "later"); // 보여주는 것 1 + 기다리는 줄 1
    const req = { id: ++this.askSeq, conn, info, t0: this.now() };
    this.pending.push(req);
    conn.send({ _n: "wait", ms: NET_ASK_TIMEOUT });
    netTimer(() => this.sweep(), NET_ASK_TIMEOUT + 50);
    if (this.pending[0] === req) this.emit("ask", req);
  }
  // 방장이 "예"(yes=true) / "아니오"
  answer(id, yes) {
    const req = this.pending.find((r) => r.id === id);
    if (!req) return false;
    const conn = req.conn;
    if (!yes) { this.refuse(conn, "denied"); return true; }
    this.forget(conn);
    if (!conn.open) return false;
    if (this.locked) { this.refuse(conn, "locked"); return false; }
    if (1 + this.peers.size >= NET_MAX_PLAYERS) { this.refuse(conn, "full"); return false; }
    this.admit(conn, req.info);
    return true;
  }
  admit(conn, info) {
    this.forget(conn);
    let slot = 2;
    while (this.peers.has(slot)) slot++;
    conn._slot = slot;
    const p = { slot, conn, fast: null, remote: conn.remote, info, lastSeen: Date.now(), rtt: null };
    this.peers.set(slot, p);
    conn.send({ _n: "slot", slot, count: 1 + this.peers.size, info: this.info, build: NET_BUILD });
    this.broadcastCount();
    this.emit("join", slot, p.info);
  }
  // 인사 없이 5초 / 허락 없이 30초 지난 연결은 끊어요 (핑 시계와 타이머에서 불러요)
  sweep(now = this.now()) {
    for (const [conn, t0] of [...this.waiting]) if (now - t0 > NET_HI_TIMEOUT) { this.waiting.delete(conn); try { conn.close(); } catch (e) { /* 무시 */ } }
    for (const req of [...this.pending]) if (now - req.t0 > NET_ASK_TIMEOUT) this.refuse(req.conn, "denied");
    for (const [conn, t0] of [...this.closing]) if (now - t0 >= 250 || !conn.open) { this.closing.delete(conn); try { conn.close(); } catch (e) { /* 무시 */ } }
  }
  broadcastCount() {
    for (const p of this.peers.values()) p.conn.send({ _n: "count", count: 1 + this.peers.size });
  }
  dropPeer(slot, why) {
    const p = this.peers.get(slot);
    if (!p) return;
    this.peers.delete(slot);
    try { p.conn.close(); } catch (e) { /* 무시 */ }
    try { if (p.fast) p.fast.close(); } catch (e) { /* 무시 */ }
    delete this.rtt[slot];
    if (this.role === "host") this.broadcastCount();
    this.emit("leave", slot, why);
    if (this.role === "guest") { this.emit("error", netError("lost")); this.cleanup(); }
  }

  // ----- 방 들어가기 -----
  async join(code, opts = {}) {
    this.leave(true);
    code = String(code).replace(/\D/g, "").slice(0, NET_CODE_LEN);
    const t = this.makeTransport();
    this.transport = t;
    try {
      if (code.length !== NET_CODE_LEN) throw netError("no-room", code);
      const conn = await t.connect(NET_ID_PREFIX + code, { timeout: opts.timeout });
      const slot = await new Promise((resolve, reject) => {
        let to = setTimeout(() => reject(netError("timeout")), opts.timeout || NET_JOIN_TIMEOUT);
        conn.onData((d) => {
          if (!d || !d._n || this.role) return;
          if (!this.rateOk(conn)) { conn.close(); return; }
          if (d._n === "wait") { clearTimeout(to); to = setTimeout(() => reject(netError("denied")), NET_ASK_TIMEOUT + 5000); this.emit("waiting"); }
          if (d._n === "slot") {
            clearTimeout(to);
            if (d.build !== NET_BUILD) { reject(netError("version")); conn.close(); return; }
            if (!Number.isInteger(d.slot) || d.slot < 2 || d.slot > NET_MAX_PLAYERS) { reject(netError("lost")); conn.close(); return; }
            this.hostInfo = {}; this.lastCount = Math.max(2, Math.min(NET_MAX_PLAYERS, d.count | 0)); resolve(d.slot);
          }
          if (d._n === "reject") { clearTimeout(to); reject(netError(Object.hasOwn(NET_TEXT, d.code) ? d.code : "lost")); }
        });
        conn.onClose(() => { clearTimeout(to); reject(netError("lost")); });
        conn.send({ _n: "hi", ver: NET_PROTOCOL, build: NET_BUILD, info: this.info });
      });
      this.role = "guest"; this.code = code; this.slot = slot;
      const p = { slot: 1, conn, fast: null, remote: conn.remote, info: this.hostInfo || {}, lastSeen: Date.now(), rtt: null };
      this.peers.set(1, p);
      conn.onData((d) => { if (p.conn !== conn) return; if (!this.rateOk(conn)) return this.flood(conn); if (!(d && (d._n === "slot" || d._n === "reject" || d._n === "wait"))) this.onData(1, d); });
      conn.onClose(() => this.dropPeer(1, "closed"));
      // 빠른 길 (선택): 상태 스냅샷용
      if (this.opts.fast && t.connect && this.transportName === "peer") {
        t.connect(NET_ID_PREFIX + code, { kind: "fast", timeout: 8000 }).then((fc) => { p.fast = fc; fc.onData((d) => { if (!this.rateOk(fc)) return this.flood(fc); this.onData(1, d); }); fc.onClose(() => { if (p.fast === fc) p.fast = null; }); }).catch(() => {});
      }
      this.startPing();
      this.emit("open", { role: "guest", code, slot });
      return slot;
    } catch (e) {
      const err = e && e.text ? e : netError("timeout");
      this.cleanup();
      this.emit("error", err);
      throw err;
    }
  }

  // ----- 받은 데이터 -----
  onData(slot, d) {
    const p = this.peers.get(slot);
    if (!p) return; // 이미 나간 자리
    p.lastSeen = Date.now();
    this.stats.recv++;
    if (d && d._n) {
      if (d._n === "ping") { const c = p && (p.conn); if (c && Number.isFinite(d.t)) c.send({ _n: "pong", t: d.t }); return; }
      if (d._n === "pong") { if (!Number.isFinite(d.t)) return; const ms = Math.max(0, Math.min(99999, Math.round(Date.now() - d.t))); this.rtt[slot] = ms; if (p) p.rtt = ms; this.emit("rtt", slot, ms); return; }
      if (d._n === "count") { if (this.role !== "guest") return; this.lastCount = Math.max(1, Math.min(NET_MAX_PLAYERS, d.count | 0)); this.emit("count", this.lastCount); return; }
      if (d._n === "bye") { this.dropPeer(slot, "bye"); return; }
      return;
    }
    this.emit("message", d, slot);
  }

  // ----- 보내기 -----
  send(slot, msg) {
    const p = this.peers.get(slot);
    if (!p) return false;
    this.stats.sent++;
    p.conn.send(msg);
    return true;
  }
  sendFast(slot, msg) {
    const p = this.peers.get(slot);
    if (!p) return false;
    this.stats.sent++;
    (p.fast && p.fast.open ? p.fast : p.conn).send(msg);
    return true;
  }
  broadcast(msg, fast = false) { for (const slot of this.peers.keys()) (fast ? this.sendFast : this.send).call(this, slot, msg); }
  toHost(msg, fast = false) { return this.role === "guest" ? (fast ? this.sendFast(1, msg) : this.send(1, msg)) : false; }

  // ----- 핑 (2초마다) -----
  startPing() {
    this.stopPing();
    if (typeof setInterval === "function") this.timer = setInterval(() => this.tick(), NET_PING_EVERY);
  }
  stopPing() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  tick(now = Date.now()) {
    if (this.role === "host") this.sweep(now);
    for (const p of [...this.peers.values()]) {
      if (now - p.lastSeen > NET_LOST_AFTER) { this.dropPeer(p.slot, "timeout"); continue; }
      p.conn.send({ _n: "ping", t: now });
    }
  }

  // ----- 나가기 -----
  leave(quiet = false) {
    if (!this.role && !this.transport) return;
    for (const p of this.peers.values()) { try { p.conn.send({ _n: "bye" }); } catch (e) { /* 무시 */ } }
    this.cleanup(quiet, true); // "잘 가" 가 먼저 닿게 연결은 조금 뒤에 닫아요
  }
  cleanup(quiet = false, soft = false) {
    this.stopPing();
    const ps = [...this.peers.values()];
    this.peers.clear();
    const wait = [...this.waiting.keys(), ...this.pending.map((r) => r.conn), ...this.closing.keys()];
    const asked = this.pending.length > 0;
    this.waiting.clear(); this.pending = []; this.closing.clear(); this.locked = false;
    for (const c of wait) { try { c.close(); } catch (e) { /* 무시 */ } }
    if (asked) this.emit("askEnd");
    const closeAll = () => { for (const p of ps) { try { p.conn.close(); } catch (e) { /* 무시 */ } try { if (p.fast) p.fast.close(); } catch (e) { /* 무시 */ } } };
    if (soft) setTimeout(closeAll, 250); else closeAll();
    const t = this.transport; this.transport = null;
    if (t) setTimeout(() => t.destroy && t.destroy(), soft ? 500 : 200);
    const was = this.role;
    this.role = null; this.code = null; this.slot = 0; this.rtt = {};
    if (was && !quiet) this.emit("close", was);
  }

  // ----- 진단 (연결 시험 페이지) -----
  // 지금 쓰는 길의 ICE 후보 종류: host(같은 Wi-Fi 직접) / srflx(공유기 바깥 주소) / relay(중계)
  async iceInfo(slot) {
    const p = this.peers.get(slot || (this.role === "guest" ? 1 : [...this.peers.keys()][0]));
    const pc = p && p.conn && p.conn.pc;
    if (!pc || !pc.getStats) return null;
    const stats = await pc.getStats();
    const byId = {};
    stats.forEach((r) => { byId[r.id] = r; });
    let pair = null;
    stats.forEach((r) => {
      if (r.type === "transport" && r.selectedCandidatePairId) pair = byId[r.selectedCandidatePairId];
    });
    if (!pair) stats.forEach((r) => { if (r.type === "candidate-pair" && (r.nominated || r.selected) && r.state === "succeeded") pair = pair || r; });
    const locals = [], remotes = [];
    stats.forEach((r) => {
      if (r.type === "local-candidate") locals.push({ type: r.candidateType, addr: r.address || r.ip || "", proto: r.protocol });
      if (r.type === "remote-candidate") remotes.push({ type: r.candidateType, addr: r.address || r.ip || "", proto: r.protocol });
    });
    const L = pair && byId[pair.localCandidateId], R = pair && byId[pair.remoteCandidateId];
    const show = (c) => c && { type: c.candidateType, addr: c.address || c.ip || "", mdns: /\.local$/.test(c.address || c.ip || ""), proto: c.protocol };
    return { selected: pair ? { local: show(L), remote: show(R), rtt: pair.currentRoundTripTime } : null, locals, remotes };
  }
}

// 방 번호: 6자리, 브라우저 암호 난수 (crypto 가 없는 시험 환경만 Math.random)
function netRoomCode() {
  const span = 10 ** NET_CODE_LEN - 10 ** (NET_CODE_LEN - 1), lo = 10 ** (NET_CODE_LEN - 1);
  const c = typeof crypto !== "undefined" && crypto && crypto.getRandomValues ? crypto : null;
  if (!c) return String(lo + Math.floor(Math.random() * span));
  const a = new Uint32Array(1), lim = Math.floor(4294967296 / span) * span; // 한쪽으로 쏠리지 않게
  do c.getRandomValues(a); while (a[0] >= lim);
  return String(lo + (a[0] % span));
}

const Net = new NetSession(); // 기본 세션 (만들기만 해서는 아무 연결도 안 해요)

export {
  NetSession, NetLoopback, Net, netError, netRoomCode, netIceServers, netLoadPeerLib,
  NET_PROTOCOL, NET_BUILD, NET_ID_PREFIX, NET_CODE_LEN, NET_MAX_PLAYERS, NET_ICE_URL, NET_STUN, NET_TEXT,
};
