// ═══════════════════════════════════════════════════════════════
// WATAHA MILICZ — Service Worker
// Caching strategy: stale-while-revalidate for app shell + assets
// Push notifications: receives Web Push events from server
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = "wataha-cache-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

// ── INSTALL: pre-cache app shell ─────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn("[SW] Pre-cache failed:", err))
  );
});

// ── ACTIVATE: clean old caches ────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH: stale-while-revalidate for same-origin GET ────────
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Bypass cross-origin (tiles, CDN libs, fonts) — let the browser handle them
  if (url.origin !== self.location.origin) return;

  // Don't cache the SW itself or POST endpoints
  if (url.pathname === "/service-worker.js") return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(req).then(cached => {
        const networkFetch = fetch(req).then(res => {
          if (res && res.status === 200 && res.type === "basic") {
            cache.put(req, res.clone());
          }
          return res;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    )
  );
});

// ── PUSH: handle incoming Web Push messages from server ──────
self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: "Wataha Milicz", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Wataha Milicz";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [80, 40, 80],
    tag: payload.tag || "wataha-" + Date.now(),
    renotify: !!payload.renotify,
    data: { url: payload.url || "/", ...payload.data },
    actions: payload.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── NOTIFICATION CLICK: focus or open the app ────────────────
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ("focus" in client) {
          client.postMessage({ type: "notification-click", url: targetUrl });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// ── MESSAGE: allow client to trigger SW updates ──────────────
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
