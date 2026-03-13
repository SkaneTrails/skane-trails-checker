/**
 * Service worker for offline PWA support.
 *
 * Strategy:
 * - Static assets (JS, CSS, images, fonts): cache-first
 * - Unauthenticated API calls: network-first with cache fallback
 * - Navigation: network-first, falls back to cached app shell
 * - Authenticated API calls: network-only (never cached)
 */

const CACHE_NAME = 'skane-trails-v1';
const APP_SHELL = '/';

/** Patterns for static assets to cache (matched against pathname). */
const STATIC_PATTERNS = [/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)(\?.*)?$/];

/** @param {string} url */
function isStaticAsset(url) {
  try {
    const pathname = new URL(url).pathname;
    return STATIC_PATTERNS.some((p) => p.test(pathname));
  } catch {
    return false;
  }
}

/** @param {string} url */
function isApiCall(url) {
  return url.includes('/api/');
}

self.addEventListener('install', (event) => {
  // Pre-cache the app shell for offline navigation fallback
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clean up old caches and claim clients in one waitUntil
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      ),
      self.clients.claim(),
    ]),
  );
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
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)),
            );
          }
          return response;
        }),
      ),
    );
  } else if (isApiCall(url)) {
    // Skip caching for authenticated requests (security: don't persist private data)
    if (request.headers.has('Authorization')) return;

    // Unauthenticated API calls: network-first, cache fallback
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)),
            );
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response('{}', {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }))),
    );
  } else if (request.mode === 'navigate') {
    // Navigation: network-first, fall back to cached app shell
    event.respondWith(
      fetch(request).catch(() => caches.match(APP_SHELL)),
    );
  }
});
