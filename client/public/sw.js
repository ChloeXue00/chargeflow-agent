/* ChargeFlow Agent — service worker (PWA installability + offline shell).
 * Strategy: NETWORK-FIRST for everything so users always get the latest deploy;
 * cache is only a fallback when offline. The API is never cached. */
const CACHE = 'chargeflow-v2';
const SHELL = ['/', '/m'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;                          // never touch POST /api/chat
  if (new URL(request.url).pathname.includes('/api/')) return;   // never cache the agent API

  // Network-first: always try the network, fall back to cache only when offline.
  event.respondWith(
    fetch(request)
      .then((resp) => {
        if (resp && resp.ok && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});
