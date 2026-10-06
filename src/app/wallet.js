// 하트 보석 서버 지갑: 기기 쪽 네트워크(서버 /wallet…). 규칙은 core/wallet.js, 설계 docs/wallet.md
// 지갑 열쇠는 기기가 만든 무작위 32바이트. 서버엔 해시만 간다. 보석은 서버에 닿을 때만 받고 쓸 수 있다.
import { PUSH_SERVER } from "./push.js?v=b27e75e-1791277839";
import { walletOf, applyServerWallet, migratePayload } from "../core/wallet.js?v=b27e75e-1791277839";

const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const newWalletKey = () => b64u(crypto.getRandomValues(new Uint8Array(32)));
export const newOp = () => b64u(crypto.getRandomValues(new Uint8Array(16)));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const acctOf = async (key) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("acct:" + key)));

// 연결 상태: navigator.onLine만 믿지 않고 실제 요청 결과로 판단(capacitor-offline-first)
export const net = { ok: false, at: 0 };
const TIMEOUT_MS = 10_000;

async function call(method, path, key, body, { extraHeaders = {}, timeout = TIMEOUT_MS } = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(PUSH_SERVER + path, {
      method, signal: ctl.signal,
      headers: { "content-type": "application/json", "x-wallet-key": key, ...extraHeaders },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = {}; try { data = await res.json(); } catch { /* 빈 응답 */ }
    net.ok = res.status < 500 || res.status === 503; net.at = Date.now();
    return { status: res.status, data };
  } catch (e) {
    net.ok = false; net.at = Date.now();
    return { status: 0, data: { error: ctl.signal.aborted ? "slow" : "offline" } };
  } finally { clearTimeout(t); }
}

// 지갑이 있으면 받아 오고, 없으면(열쇠는 있는데 서버에 없음 포함) 만든다. 만들 때 옛 기기 잔액을 한 번 옮긴다
export async function ensureWallet(profile, save) {
  const wl = walletOf(profile);
  if (!wl.key) { wl.key = newWalletKey(); save(); } // 열쇠를 먼저 저장(응답을 못 받아도 같은 열쇠로 다시)
  if (wl.created) return refresh(profile, save);
  const r = await call("POST", "/wallet", wl.key, { migrate: wl.migrated ? null : migratePayload(profile.econ) });
  if (r.status === 201 || r.status === 409) { wl.migrated = true; applyServerWallet(profile, r.data); save(); return { ok: true, data: r.data }; }
  return { ok: false, status: r.status, data: r.data };
}
export async function refresh(profile, save) {
  const wl = walletOf(profile);
  if (!wl.key) return { ok: false };
  const r = await call("GET", "/wallet", wl.key);
  if (r.status === 404) { wl.created = false; wl.migrated = true; return ensureWallet(profile, save); } // 정리됐거나 아직 없음 → 새로(받은 보석 이관은 다시 안 함)
  if (r.status === 200) { applyServerWallet(profile, r.data); save(); return { ok: true, data: r.data }; }
  return { ok: false, status: r.status, data: r.data };
}

// 보석으로 꾸미기 사기. 요청 중 앱이 꺼져도 같은 op로 다시 보내면 두 번 빠지지 않는다
export async function spendGem(profile, save, item, expect) {
  const wl = walletOf(profile);
  if (!wl.created) { const c = await ensureWallet(profile, save); if (!c.ok) return { ok: false, status: c.status || 0, data: c.data || {} }; }
  if (!wl.inflight || wl.inflight.item !== item) { wl.inflight = { op: newOp(), item }; save(); }
  const r = await call("POST", "/wallet/spend", wl.key, { op: wl.inflight.op, item, expect });
  if (r.status !== 0) { wl.inflight = null; if (r.data?.w) applyServerWallet(profile, r.data); save(); }
  return { ok: r.status === 200, status: r.status, data: r.data };
}

// 무료 보석 대기열 보내기(받음·이미 받음·아직 아님이면 대기열에서 지움, 연결 문제면 남김). 돌려줌: 이번에 받은 보석 수
let flushing = false;
export async function flushEarn(profile, save) {
  const wl = walletOf(profile);
  if (flushing || !wl.queue.length) return 0;
  flushing = true; let got = 0;
  try {
    if (!wl.created) { const c = await ensureWallet(profile, save); if (!c.ok) return 0; }
    while (wl.queue.length) {
      const it = wl.queue[0];
      const r = await call("POST", "/wallet/earn", wl.key, { op: it.op, kind: it.kind, id: it.id || undefined });
      if (r.status === 0 || r.status >= 500 || r.status === 429) break;
      if (r.status === 200 && !r.data.again) got += r.data.gained || 0;
      if (r.data?.w) applyServerWallet(profile, r.data);
      wl.queue.shift(); save();
    }
  } finally { flushing = false; }
  return got;
}

// 결제 적립(서버가 결제 모드에 따라 확인). 돌려줌: { ok, first, already, stars, pending, off, error }
export async function creditPurchase(profile, save, { token, sku, orderId }) {
  const wl = walletOf(profile);
  const r = await call("POST", "/wallet/purchase", wl.key, { token, sku, orderId }, { timeout: 20_000 });
  if (r.data?.w) { applyServerWallet(profile, r.data); save(); }
  if (r.status === 200) return { ok: true, first: !!r.data.first, already: !!r.data.already, stars: r.data.stars || 0 };
  return { ok: false, status: r.status, reason: r.data?.reason, pending: r.status === 202, voided: r.status === 410, error: r.data?.error };
}

// 다른 기기 기록을 불러와 지갑이 바뀔 때: 옛 지갑의 산 보석·산 꾸미기를 새 지갑으로(받은 보석은 안 옮김)
export async function mergeInto(newKey, oldKey) {
  const r = await call("POST", "/wallet/merge", newKey, { op: newOp(), from: oldKey });
  return { ok: r.status === 200, status: r.status, data: r.data };
}
export async function linkSave(walletKey, saveKey) {
  const r = await call("POST", "/wallet/link", walletKey, null, { extraHeaders: { "x-save-key": saveKey } });
  return r.status === 200;
}
export async function deleteWallet(walletKey) {
  const r = await call("DELETE", "/wallet", walletKey);
  return r.status === 200;
}

// ---- 이어하기 기록에 넣는 지갑 열쇠: 이어하기 코드로 만든 열쇠로 기기에서 잠근다(서버 DB가 새도 지갑 열쇠는 안 보이게, SEC-008) ----
async function aesFromSaveKey(saveKey, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(saveKey), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: new TextEncoder().encode("almochi-wallet") }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
export async function sealWalletKey(walletKey, saveKey) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesFromSaveKey(saveKey, salt), new TextEncoder().encode(walletKey));
  return { v: 1, for: (await acctOf("seal:" + saveKey)).slice(0, 12), salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}
export async function openWalletKey(enc, saveKey) {
  if (!enc?.ct || !saveKey) return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(enc.iv) }, await aesFromSaveKey(saveKey, unb64(enc.salt)), unb64(enc.ct));
    return new TextDecoder().decode(pt);
  } catch { return null; }
}
export const sealedFor = async (enc, saveKey) => !!enc && enc.for === (await acctOf("seal:" + saveKey)).slice(0, 12);
