const CACHE_NAME = "red-rural-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./firebase-init.js",
  "./icons/icon-192.png",
  "./empleado/login.html",
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
  const req = event.request;
  const url = new URL(req.url);

  // Para otros dominios (Firebase, gstatic, unpkg, etc) → network-first
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Same-origin: cache-first (rápido)
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
