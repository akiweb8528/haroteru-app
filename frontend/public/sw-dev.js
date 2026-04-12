const CACHE = 'haroteru-dev-v1';
const RSC_CACHE = 'haroteru-dev-rsc-v1';
const OFFLINE_FALLBACK = '/offline.html';
let simulateOffline = false;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_FALLBACK))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SET_SIMULATE_OFFLINE') return;

  simulateOffline = Boolean(event.data.payload?.offline);

  self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      client.postMessage({
        type: 'SIMULATE_OFFLINE_CHANGED',
        payload: { offline: simulateOffline },
      });
    }
  });
});
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
    event.respondWith(fetchAndCacheRsc(request));
  }
});
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
async function fetchAndCacheNavigation(request) {
  const cache = await caches.open(CACHE);

  try {
    const response = await fetch(request);
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
async function fetchAndCacheRsc(request) {
  const cache = await caches.open(RSC_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
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
