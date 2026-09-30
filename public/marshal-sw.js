// Service worker for marshal.html ONLY. Its one job: let the page itself
// (and the QR scanner library it loads) survive a full reload with zero
// connection — e.g. after the phone locks and the browser discards the tab
// over a long shift. It never touches /api/* calls; those always go to the
// network untouched, so the app's own offline queue in marshal.html (not
// this file) is what actually handles scans made while offline.
//
// Bump CACHE_VERSION whenever marshal.html changes and is redeployed —
// this is what prevents a marshal's phone from being stuck on an old,
// already-fixed version forever (the exact pitfall called out in the
// original brief, this time handled with an explicit version instead of
// relying on HTTP cache headers, which this worker sits in front of).
const CACHE_VERSION = 'marshal-v1';
const PRECACHE_URLS = [
  '/marshal.html',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Inter:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', (event) => {
  // Each URL is cached independently rather than via cache.addAll(), which
  // is all-or-nothing — a single failure (a flaky font CDN, an ad-blocker,
  // a firewall) would otherwise silently prevent EVERYTHING from being
  // cached, including marshal.html itself and the QR library, even though
  // those two had nothing to do with the failure. The page and the
  // scanner are what actually matter for offline use; the Google Fonts
  // file is a nice-to-have that should never be able to take the other
  // two down with it.
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(PRECACHE_URLS.map((url) =>
        cache.add(url).catch((e) => console.warn('[marshal-sw] precache failed for', url, e))
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never intercept anything API-related, or POSTs of any kind — those must
  // always reach the real network (or fail naturally, which the page's own
  // queue-and-retry logic already handles).
  if (req.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  const isPrecached = PRECACHE_URLS.includes(req.url) || PRECACHE_URLS.includes(url.pathname);
  if (!isPrecached) return; // everything else: normal browser behaviour, untouched

  // Cache-first for the page shell and the QR library, so a reload works
  // with zero connection — but always try to refresh the cache in the
  // background when online, so a marshal who stays connected still gets
  // fixes promptly rather than being stuck on whatever was first cached.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(req, res.clone()));
        return res;
      }).catch(() => null);
      return cached || fetchPromise;
    })
  );
});
