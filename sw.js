/* K.'s Recipes service worker.

   Strategy: network-first for our own files, cache as fallback.

   Why network-first and not the usual cache-first: this app is edited often and
   installed to a home screen, where iOS caches HTML so aggressively that new
   versions never appear. Network-first means every launch with a signal gets the
   current file, and the cache only steps in when the network fails — which also
   makes the app work on airplane mode in the kitchen.

   Only same-origin GETs are touched. Kroger Worker calls, Google Fonts, and
   anything cross-origin pass straight through and are never cached.
*/

const CACHE = 'ks-recipes-v1';

self.addEventListener('install', event => {
  // Take over immediately rather than waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(n => n !== CACHE).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Worker API, fonts, etc.

  event.respondWith(
    fetch(req)
      .then(res => {
        // Only cache real successes. Opaque and error responses are skipped so a
        // bad deploy can't get pinned in the cache.
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => hit || caches.match('./index.html'))
      )
  );
});

// Lets the page trigger an immediate update rather than waiting for a relaunch.
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
