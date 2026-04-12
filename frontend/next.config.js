/** @type {import('next').NextConfig} */
const withPWA = require('@ducanh2912/next-pwa').default;

// Captured once per `next build` invocation.  Every deployment gets a fresh
// revision so Workbox re-fetches precached page HTML on SW update.
const BUILD_REVISION = Date.now().toString();

// Page routes that must be available offline immediately after install,
// even if the user has never individually visited them.
const PAGE_MANIFEST_ENTRIES = [
  '/',
  '/auth/signin',
  '/subscriptions',
  '/settings',
  '/terms',
  '/privacy',
].map((url) => ({ url, revision: BUILD_REVISION }));

const nextConfig = {
  async headers() {
    // Inline scripts are required for the theme-init snippet and Google Analytics,
    // so 'unsafe-inline' cannot be removed without a nonce-based middleware.
    // All other directives are as restrictive as possible.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline'",
      // Google profile pictures; data:/blob: for Next.js image optimisation
      "img-src 'self' data: blob: https://lh3.googleusercontent.com",
      // next/font self-hosts Inter at build time — no external font origin needed
      "font-src 'self'",
      // GA reporting endpoint
      "connect-src 'self' https://www.google-analytics.com https://analyticsengine.googleapis.com",
      // Never allow this app to be embedded in a foreign frame (clickjacking)
      "frame-ancestors 'none'",
      // Block Flash / legacy plugins
      "object-src 'none'",
      // Prevent <base> tag injection
      "base-uri 'self'",
      // NextAuth submits forms to its own /api/auth/* routes only
      "form-action 'self'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // DENY instead of SAMEORIGIN — this app has no legitimate iframe use case
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google profile pictures
      },
    ],
  },
  // Expose BACKEND_URL only server-side
  serverRuntimeConfig: {
    backendUrl: process.env.BACKEND_URL || 'http://localhost:8080',
  },
  // Expose to the client
  publicRuntimeConfig: {
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  },
};

module.exports = withPWA({
  // Output directory for generated sw.js (served at /sw.js)
  dest: 'public',
  // SW registration is handled manually in ServiceWorkerRegistration.tsx
  register: false,
  // Manual update flow: ServiceWorkerRegistration.tsx posts SKIP_WAITING
  skipWaiting: false,
  // Disable PWA in development; sw-dev.js is used via DevPwaPanel instead
  disable: process.env.NODE_ENV !== 'production',
  // Don't auto-precache the start URL — it's included in PAGE_MANIFEST_ENTRIES
  cacheStartUrl: false,
  // Don't force a reload on reconnect — we show a custom reconnected banner
  reloadOnOnline: false,
  // Exclude the dev-only service worker from the production precache manifest
  publicExcludes: ['sw-dev.js'],
  workboxOptions: {
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    // Bundle workbox runtime into sw.js to avoid a separate workbox-*.js file
    inlineWorkboxRuntime: true,
    // Navigate requests that miss the precache fall back to offline.html
    navigateFallback: '/offline.html',
    // Never intercept /api/* navigations with the fallback
    navigateFallbackDenylist: [/^\/api\//],
    // Precache app page routes with a per-build revision so stale HTML is
    // replaced after each deployment.  offline.html and other public/ assets
    // are auto-precached by next-pwa with content-hash revisions.
    additionalManifestEntries: PAGE_MANIFEST_ENTRIES,
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
      },
      // -----------------------------------------------------------------------
      // RSC navigation payloads
      //
      // Next.js App Router navigates between pages by issuing same-origin fetch
      // requests carrying the "RSC: 1" header.  These are fetch-mode requests
      // (not navigate-mode), so the precache layer never intercepts them.
      // Caching them here with NetworkFirst means previously-visited routes
      // remain navigable when offline even if the fetch guard in
      // OfflineNavigationHandler already converts the request to a full reload.
      // ignoreVary is required: RSC responses carry a broad Vary header that
      // would otherwise prevent cache hits on subsequent visits.
      // -----------------------------------------------------------------------
      {
        urlPattern: ({ url, request }) => (
          url.origin === self.location.origin
          && !url.pathname.startsWith('/api/')
          && !url.pathname.startsWith('/_next/')
          && request.headers.get('RSC') === '1'
        ),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'rsc-responses',
          networkTimeoutSeconds: 3,
          expiration: {
            maxEntries: 30,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          },
          matchOptions: {
            ignoreVary: true,
          },
        },
      },
      // Google profile pictures
      {
        urlPattern: ({ url }) => url.origin === 'https://lh3.googleusercontent.com',
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'remote-images',
          expiration: {
            maxEntries: 24,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          },
        },
      },
      // /_next/static/ — belt-and-suspenders alongside the auto-precache
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/_next/static/'),
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'next-static-assets',
        },
      },
      // Same-origin style / script / font / worker assets
      {
        urlPattern: ({ request, url }) => (
          url.origin === self.location.origin
          && ['style', 'script', 'font', 'worker'].includes(request.destination)
        ),
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-resources',
        },
      },
      // Same-origin images
      {
        urlPattern: ({ request, url }) => (
          request.destination === 'image'
          && url.origin === self.location.origin
        ),
        handler: 'CacheFirst',
        options: {
          cacheName: 'images',
          expiration: {
            maxEntries: 48,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
        },
      },
    ],
  },
})(nextConfig);
