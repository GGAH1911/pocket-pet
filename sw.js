// 서비스 워커: 알림 서버가 보낸 웹 푸시를 받아 알림을 띄운다.
// 메시지는 Declarative Web Push 형식({ web_push: 8030, notification: {...} }).
// iOS 18.4+는 이 JSON만으로도 알림을 띄우고, 여기서 다시 띄우면 그걸로 바꿔 보여 준다.
// 주의(iPhone): 푸시를 받고 알림을 안 띄우면 구독이 취소된다. 어떤 경우에도 반드시 showNotification 한다.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { notification: { body: event.data ? event.data.text() : "" } }; }
  const n = data.notification || {};
  event.waitUntil((async () => {
    await self.registration.showNotification(n.title || "포켓 펫", {
      body: n.body || "펫이 부르고 있어요",
      tag: n.tag || "pocket-pet",
      renotify: true,
      lang: "ko",
      icon: "icons/icon-192.png",
      badge: "icons/small-72.png",
      data: { url: n.navigate || self.registration.scope },
    });
    try {
      if (typeof data.badge === "number" && self.navigator.setAppBadge) {
        if (data.badge > 0) await self.navigator.setAppBadge(data.badge); else await self.navigator.clearAppBadge();
      }
    } catch { /* 배지 미지원 기기 */ }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) if (c.url.startsWith(self.registration.scope)) { await c.focus(); return; }
    await self.clients.openWindow(url);
  })());
});
