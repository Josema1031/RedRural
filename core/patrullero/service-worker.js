const CACHE_NAME = "vigia-rural-v1";
const OFFLINE_URL = "./login.html";

const APP_SHELL = [
  "./",
  "./login.html",
  "./registro.html",
  "./manifest.json",
  "./icons/vigia-192.png",
  "./icons/vigia-512.png",
  "../css/patrullero-login.css",
  "../js/modules/patrullero/login.js"
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
    await Promise.all(
      keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(request);
        return cached || caches.match(OFFLINE_URL);
      }
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

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
  }
});