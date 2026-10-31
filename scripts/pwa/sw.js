// The game's service worker: keeps the built game in a cache so it starts and plays without a network.
// Written into the build by scripts/pwa/plugin.mjs, which fills in the version and the list of files.
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = `survival-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // an older version's files go
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('survival-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // the page itself: the network first, so a new version is found when online; the cached one when not
    e.respondWith(fetch(req).catch(() => caches.match('./', { cacheName: CACHE, ignoreVary: true, ignoreSearch: true })));
    return;
  }
  // the rest have hashed names or never change: the cache first (module scripts ask with an Origin header, and a
  // server that answers with "Vary: Origin" would otherwise never match what was cached without one)
  e.respondWith(caches.match(req, { cacheName: CACHE, ignoreVary: true }).then((hit) => hit || fetch(req)));
});
