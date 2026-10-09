// 새 버전 알림 창. 앱: latest.json(플레이에 올린 버전)과 설치된 versionCode 비교 → 플레이 스토어 열기. 웹: version.txt가 바뀌면 새로고침.
import { updateState, webOutdated, SNOOZE_MS } from "../core/update.js?v=06aede1-1791546909";
import * as native from "./native.js?v=06aede1-1791546909";
const SITE = "https://ggah1911.github.io/pocket-pet/";
const SNOOZE_KEY = "pocket-pet:update-snooze";
const CHECK_GAP = 30 * 60 * 1000;
let lastCheck = 0, info = null, latest = null;
const loadedV = (() => { try { return new URL(import.meta.url).searchParams.get("v"); } catch { return null; } })();

const get = async (path) => { const r = await fetch(`${SITE}${path}?t=${Date.now()}`, { cache: "no-store" }); if (!r.ok) throw new Error(r.status); return r; };
const snooze = () => { try { return JSON.parse(localStorage.getItem(SNOOZE_KEY) || "null"); } catch { return null; } };

function card({ title, body, ok, okText, later, force, help }) {
  document.querySelector(".dexcard.update")?.remove();
  const c = document.createElement("div"); c.className = "dexcard update";
  const inner = document.createElement("div"); inner.className = "dexcard-in";
  const h = document.createElement("h3"); h.textContent = title;
  const p = document.createElement("p"); p.style.whiteSpace = "pre-line"; p.style.textAlign = "left"; p.textContent = body;
  const b = document.createElement("button"); b.className = "big"; b.textContent = okText; b.onclick = ok;
  inner.append(h, p, b);
  if (help) { const d = document.createElement("details"); d.className = "small"; d.style.textAlign = "left"; d.style.marginTop = "8px"; const s = document.createElement("summary"); s.textContent = "플레이 스토어에 업데이트가 안 보이면"; const t = document.createElement("p"); t.style.whiteSpace = "pre-line"; t.textContent = help; d.append(s, t); inner.append(d); }
  if (!force) { const l = document.createElement("button"); l.className = "big ghost"; l.textContent = "나중에"; l.onclick = () => { later?.(); c.remove(); }; inner.append(l); }
  c.append(inner); document.body.append(c);
}
const HELP = "1. 플레이 스토어에서 알모찌를 검색해 앱 페이지를 직접 열어 보세요(목록보다 빨리 바뀌어요).\n2. 휴대폰 설정 → 애플리케이션 → Google Play 스토어 → 저장공간 → 캐시 삭제 후 다시 열기.\n3. 내부 테스트는 올린 뒤 몇 분~몇 시간 걸릴 수 있어요.\n4. 앱 버전 이름에 debug가 있으면 직접 깐 시험판이라 플레이로 업데이트되지 않아요. 이어하기를 켠 뒤 지우고 플레이에서 새로 받으세요.";

let retry = null;
const later = (busy) => { clearTimeout(retry); retry = setTimeout(() => checkUpdate({ busy }), 20_000); };
// busy(): 놀이·산책·다른 창 중이면 미룸(20초 뒤·다음에 열 때 다시)
export async function checkUpdate({ busy = () => false, manual = false } = {}) {
  const now = Date.now();
  if (!manual && now - lastCheck < CHECK_GAP) return null;
  lastCheck = now;
  try {
    if (native.IS_APP) {
      info = info || (await native.appInfo());
      latest = await (await get("latest.json")).json();
      const st = updateState(info?.code, latest, manual ? null : snooze(), now);
      renderVer();
      if (!st.show) { if (manual) card({ title: "최신 버전이에요", body: `지금 버전 ${info?.name || "?"} (${info?.code || "?"})`, okText: "확인", ok: () => document.querySelector(".dexcard.update")?.remove(), force: true }); return st; }
      if (busy() && !st.force && !manual) { lastCheck = 0; later(busy); return st; } // 선물 창·놀이 중이면 20초 뒤 다시
      card({
        title: st.force ? "꼭 업데이트해 주세요" : "새 버전이 나왔어요",
        body: `지금 ${info.name} → 새 버전 ${latest.name}\n${latest.notes || ""}${st.force ? "\n\n이 버전은 고쳐야 할 문제가 있어 업데이트해야 계속할 수 있어요." : ""}`,
        okText: "업데이트하러 가기", ok: () => native.openStore(), force: st.force, help: HELP,
        later: () => localStorage.setItem(SNOOZE_KEY, JSON.stringify({ code: latest.code, until: now + SNOOZE_MS })),
      });
      return st;
    }
    if (!loadedV) return null; // 개발 서버
    const siteV = (await (await get("version.txt")).text()).trim();
    if (!webOutdated(loadedV, siteV)) return null;
    if (busy() && !manual) { lastCheck = 0; later(busy); return null; }
    card({ title: "새 버전이 있어요", body: "새로고침하면 바로 새 버전으로 바뀌어요. 키우던 친구는 그대로예요.", okText: "새로고침", ok: () => location.reload() });
    return { show: true };
  } catch { lastCheck = 0; return null; } // 인터넷이 없으면 다음에
}
export function renderVer() {
  const box = document.getElementById("app-ver"); if (!box) return;
  box.textContent = "";
  const t = native.IS_APP ? `앱 버전 ${info?.name || "?"} (${info?.code || "?"})${latest?.code > (info?.code || 0) ? ` · 새 버전 ${latest.name} 있음` : latest ? " · 최신" : ""}` : `웹 버전 ${loadedV || "개발"}`;
  box.append(document.createTextNode(t + " "));
  const b = document.createElement("button"); b.className = "link"; b.textContent = "업데이트 확인"; b.onclick = () => checkUpdate({ manual: true });
  box.append(b);
}
export async function initUpdate(opts) { if (native.IS_APP) info = await native.appInfo(); renderVer(); setTimeout(() => checkUpdate(opts), 4000); }
