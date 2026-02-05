const CACHE_NAME = "red-rural-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./firebase-init.js",
  "./icons/icon-192.png",
  "./empleado/login.html",
   "./productor/login.html",
  "./icons/icon-512.png"
  // Si tu panel empleado está en otra ruta, agregalo:
  // "./empleado/panel.html"
];

// Instalación: precache del shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activación: limpiar caches viejos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first para same-origin; network-first para CDNs
self.addEventListener("fetch", (event) => {
  event.respondWith((async () => {
    try {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      const net = await fetch(event.request);
      return net; // ✅ Response válido
    } catch (err) {
      // ✅ fallback: Response válido aunque no haya red
      return new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});

