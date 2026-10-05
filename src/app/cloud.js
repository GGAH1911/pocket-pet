// 클라우드 이어하기: 기기 저장이 기본, 켜 두면 서버(Cloudflare D1)에 저장 문자열 한 덩어리를 백업한다.
// 로그인 없음. '이어하기 코드'(무작위 32글자) 하나로 다른 기기에서 이어 한다. 서버엔 코드의 해시만 남는다.
// 설계·근거: docs/cloud-save.md (서브에이전트 자문: D1, 최신 우선 + 충돌 시 고르기, 업로드는 아껴서)
import { PUSH_SERVER } from "./push.js?v=2f02a32-1791208752";
import { migrateProfile } from "./store.js?v=2f02a32-1791208752";

// 헷갈리는 글자(0/O, 1/I/L, U) 뺀 32글자 → 한 글자 5비트, 32글자 = 160비트
const ALPHA = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // 30글자(무작위성은 32자리로 충분: 30^32 ≈ 2^157)
export function newSaveKey() {
  const b = new Uint8Array(32); crypto.getRandomValues(b);
  return Array.from(b, (x) => ALPHA[x % ALPHA.length]).join("");
}
// 보여 줄 때는 4글자씩 끊어서, 받을 때는 띄어쓰기·대시·소문자를 정리
export const showKey = (k) => (k || "").match(/.{1,4}/g)?.join("-") || "";
export function readKey(input) {
  const k = String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return k.length === 32 && [...k].every((c) => ALPHA.includes(c)) ? k : null;
}

// 서버에 올릴 내용: 기기마다 다른 것(알림 연결, 기기 ID, 결제 대기, 이어하기 상태)은 뺀다
export function blobOf(profile) {
  const { cloud, push, deviceId, payPending, ...rest } = profile;
  return JSON.stringify({ app: "pocket-pet", at: Date.now(), profile: rest });
}
export function profileFromBlob(blob, current) {
  const data = JSON.parse(blob);
  if (data?.app !== "pocket-pet" || !data.profile) throw new Error("알모찌 기록이 아니에요");
  const p = migrateProfile(data.profile);
  if (!p) throw new Error("읽을 수 없는 기록이에요");
  p.deviceId = current.deviceId; p.push = current.push; p.payPending = current.payPending;
  return p;
}

// 언제 올리나: 바뀐 게 있고 마지막 업로드 뒤 90초가 지났을 때 / 앱을 내릴 때 바로 / 결제 직후 바로
export const UPLOAD_GAP_MS = 90_000;
export function uploadDue(cloud, now, { urgent = false } = {}) {
  if (!cloud?.key || !cloud.dirty) return false;
  if (cloud.holdUntil && now < cloud.holdUntil) return false; // 충돌을 고르는 중·서버가 잠깐 기다리라고 함
  return urgent || now - (cloud.lastUp || 0) >= UPLOAD_GAP_MS;
}

async function call(method, key, body, { keepalive = false } = {}) {
  const res = await fetch(PUSH_SERVER + "/save", {
    method, keepalive,
    headers: { "content-type": "application/json", "x-save-key": key },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null; try { data = await res.json(); } catch { /* 빈 응답 */ }
  return { status: res.status, data: data || {} };
}
export async function cloudGet(key) {
  const { status, data } = await call("GET", key);
  if (status === 404) return null;
  if (status !== 200) throw new Error(data.error || "서버에 닿지 않아요");
  return data; // { rev, updated, blob }
}
// 결과: { ok, rev } | { conflict, rev } | { wait: ms }
export async function cloudPut(key, blob, base, { force = false, keepalive = false } = {}) {
  const { status, data } = await call("PUT", key, { blob, base: base ?? null, force }, { keepalive });
  if (status === 200) return { ok: true, rev: data.rev };
  if (status === 409) return { conflict: true, rev: data.rev };
  if (status === 429) return { wait: data.retryAfterMs || 15000 };
  throw new Error(data.error || "저장하지 못했어요");
}
export async function cloudDelete(key) {
  const { status, data } = await call("DELETE", key);
  if (status !== 200) throw new Error(data.error || "지우지 못했어요");
}
