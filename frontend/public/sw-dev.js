/**
 * Development-only service worker for testing offline/PWA behaviour with HMR.
 *
 * Design constraints
 * - /_next/* paths are NEVER intercepted so webpack HMR stays functional.
 * - /api/* paths are never intercepted so auth / backend calls are unaffected.
 * - simulateOffline lives only in memory; it resets to false on every SW start.
 * - Navigation responses (HTML pages) are cached via NetworkFirst while online
 *   so they can be served when simulateOffline is enabled.
 * - /offline.html is pre-cached during install as the guaranteed fallback.
 *
 * Workflow:
 *   1. Open the app in dev mode – pages are cached as you visit them.
 *   2. Use the DevPwaPanel (bottom-right corner) to toggle offline simulation.
 *   3. Navigate between pages and observe offline behaviour + banners.
 *   4. Hard reloads while simulating offline will partially break because
 *      /_next/static chunks are intentionally not cached (HMR trade-off).
 */

const CACHE = 'haroteru-dev-v1';
// RSC payloads are keyed by URL only (ignoring Vary headers) so they can be
// retrieved with a different Next-Router-State-Tree than when they were stored.
const RSC_CACHE = 'haroteru-dev-rsc-v1';
const OFFLINE_FALLBACK = '/offline.html';

/** In-memory offline simulation flag; false on every fresh SW start. */
let simulateOffline = false;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  // Pre-cache the offline fallback so it is always available.
  // Errors are swallowed so a missing file never blocks SW installation.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_FALLBACK))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  // Claim all open tabs so the SW takes effect without a reload.
  event.waitUntil(self.clients.claim());
});

// ---------------------------------------------------------------------------
// Message handling (toggling offline simulation from DevPwaPanel)
// ---------------------------------------------------------------------------

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SET_SIMULATE_OFFLINE') return;

  simulateOffline = Boolean(event.data.payload?.offline);

  // Broadcast the new state back to all clients so the panel UI stays in sync.
  self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      client.postMessage({
        type: 'SIMULATE_OFFLINE_CHANGED',
        payload: { offline: simulateOffline },
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Fetch handling
// ---------------------------------------------------------------------------

/**
 * Returns true for requests that must always reach the network:
 *   - Next.js internals (HMR, static chunks, image optimisation)
 *   - Auth / backend API routes
 *   - Non-GET methods
 *   - Cross-origin requests
 *
 * Note: same-origin page paths with the "RSC: 1" header are NOT passed through
 * here — they are handled by fetchAndCacheRsc so they can be served offline.
 */
function shouldPassThrough(request) {
  if (request.method !== 'GET') return true;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return true;

  const p = url.pathname;
  if (
    p.startsWith('/_next/') ||
    p.startsWith('/api/') ||
    p.includes('__nextjs') ||
    p.includes('__webpack')
  ) {
    return true;
  }

  // Server-sent events / streaming responses
  if (request.headers.get('accept')?.includes('text/event-stream')) return true;

  return false;
}

self.addEventListener('fetch', (event) => {
  if (shouldPassThrough(event.request)) return;

  const { request } = event;
  const isRsc = request.headers.get('RSC') === '1';

  if (simulateOffline) {
    event.respondWith(serveSimulatedOffline(request, isRsc));
  } else if (request.mode === 'navigate') {
    event.respondWith(fetchAndCacheNavigation(request));
  } else if (isRsc) {
    // Cache RSC payloads while online so they are available when simulating
    // offline (mirrors the production Workbox NetworkFirst rule).
    event.respondWith(fetchAndCacheRsc(request));
  }
  // Other non-navigate requests while online: pass through to network.
});

/**
 * When simulating offline: return the cached response if available, otherwise
 * return the offline fallback page for navigations or a 503 for everything else.
 *
 * RSC payloads are looked up by URL only (ignoreVary equivalent) because they
 * were stored that way in fetchAndCacheRsc.
 */
async function serveSimulatedOffline(request, isRsc) {
  if (isRsc) {
    const rscCache = await caches.open(RSC_CACHE);
    const cached = await rscCache.match(request.url);
    if (cached) return cached;
    return new Response('Service Unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  if (request.mode === 'navigate') {
    const fallback = await cache.match(OFFLINE_FALLBACK);
    return (
      fallback ??
      new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' },
      })
    );
  }

  return new Response('Offline', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain' },
  });
}

/**
 * NetworkFirst for navigation requests: fetch from network and cache the
 * response so it is available the next time simulateOffline is enabled.
 * Falls back to cache (then offline.html) on network failure.
 */
async function fetchAndCacheNavigation(request) {
  const cache = await caches.open(CACHE);

  try {
    const response = await fetch(request);
    // Only cache successful HTML responses.
    if (
      response.ok &&
      response.headers.get('content-type')?.includes('text/html')
    ) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    const fallback = await cache.match(OFFLINE_FALLBACK);
    return (
      fallback ??
      new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' },
      })
    );
  }
}

/**
 * NetworkFirst for RSC payloads: cache by URL only so they can be retrieved
 * regardless of the Next-Router-State-Tree header value on the next request.
 * Falls back to the cached payload on network failure (e.g. simulateOffline).
 */
async function fetchAndCacheRsc(request) {
  const cache = await caches.open(RSC_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      // Store keyed by URL string to sidestep Vary header matching.
      cache.put(request.url, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request.url);
    if (cached) return cached;

    return new Response('Service Unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
