// ── WATAHA MILICZ Service Worker ──────────────────────────────
const CACHE = "wataha-v3";
const OFFLINE_ASSETS = ["/", "/index.html"];

// Install
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — stale-while-revalidate
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  if (!e.request.url.startsWith("http")) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});

// ── WEB PUSH — powiadomienia w tle ────────────────────────────
self.addEventListener("push", e => {
  let data = { title: "Wataha Milicz", body: "Nowe powiadomienie", url: "/" };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch (_) {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    "/icon-192.png",
      badge:   "/icon-192.png",
      image:   data.image || undefined,
      vibrate: [100, 50, 100],
      tag:     data.tag || "wataha-notif",
      renotify: true,
      data:    { url: data.url || "/" },
      actions: [{ action: "open", title: "Otwórz Watahę" }],
    })
  );
});

// Klik w powiadomienie — otwórz/focus aplikację
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin)) {
          c.focus();
          return c.navigate(url);
        }
      }
      return clients.openWindow(url);
    })
  );
});
