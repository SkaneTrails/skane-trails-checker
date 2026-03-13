/**
 * Service worker for offline PWA support.
 *
 * Strategy:
 * - Static assets (JS, CSS, images, fonts): cache-first
 * - API calls: network-first with cache fallback for GET requests
 * - Navigation: network-first with offline fallback
 */

const CACHE_NAME = 'skane-trails-v1';

/** Patterns for static assets to cache. */
const STATIC_PATTERNS = [/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/];

/** @param {string} url */
function isStaticAsset(url) {
  return STATIC_PATTERNS.some((p) => p.test(url));
}

/** @param {string} url */
function isApiCall(url) {
  return url.includes('/api/');
}

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for existing clients to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip non-http(s) requests
  if (!url.startsWith('http')) return;

  if (isStaticAsset(url)) {
    // Static assets: cache-first
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }),
      ),
    );
  } else if (isApiCall(url)) {
    // API calls: network-first, cache fallback for reads
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response('{}', {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }))),
    );
  } else {
    // Navigation / other: network-first
    event.respondWith(
      fetch(request).catch(() => caches.match(request)),
    );
  }
});
