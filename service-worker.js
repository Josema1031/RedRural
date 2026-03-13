const CACHE_NAME = "red-rural-v4";
const OFFLINE_URL = "./index.html";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./firebase-init.js",
  "./css/main.css",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./img/logo.png",
  "./empleado/login.html",
  "./empleado/panel.html",
  "./productor/login.html",
  "./productor/panel.html",
  "./caminos/index.html",
  "./seguridad-ganadera/index.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Navegación HTML: network-first con fallback a cache
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await caches.match(request);
        return cached || caches.match(OFFLINE_URL);
      }
    })());
    return;
  }

  // Assets same-origin: cache-first + actualización en segundo plano
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) {
        event.waitUntil((async () => {
          try {
            const fresh = await fetch(request);
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, fresh.clone());
          } catch {}
        })());
        return cached;
      }

      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        return new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })());
    return;
  }

  // CDN / externos: network-first con fallback a cache si existiera
  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, fresh.clone());
      return fresh;
    } catch {
      const cached = await caches.match(request);
      return cached || new Response("Offline", { status: 503 });
    }
  })());
});
