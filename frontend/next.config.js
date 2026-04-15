/** @type {import('next').NextConfig} */
const withPWA = require('@ducanh2912/next-pwa').default;
const { buildContentSecurityPolicy } = require('./config/security-headers');

const DAY = 60 * 60 * 24;
const BUILD_REVISION = Date.now().toString();
const OFFLINE_FALLBACK = '/offline.html';
const PAGE_MANIFEST_ENTRIES = [
  '/',
  '/auth/signin',
  '/subscriptions',
  '/settings',
  '/terms',
  '/privacy',
].map((url) => ({ url, revision: BUILD_REVISION }));
const PRECACHE_MANIFEST_ENTRIES = [
  ...PAGE_MANIFEST_ENTRIES,
  { url: OFFLINE_FALLBACK, revision: BUILD_REVISION },
];

const nextConfig = {
  async headers() {
    const csp = buildContentSecurityPolicy({
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
    });

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
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
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  serverRuntimeConfig: {
    backendUrl: process.env.BACKEND_URL || 'http://localhost:8080',
  },
  publicRuntimeConfig: {
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  },
};

module.exports = withPWA({
  dest: 'public',
  register: false,
  skipWaiting: false,
  disable: process.env.NODE_ENV !== 'production',
  cacheStartUrl: false,
  reloadOnOnline: false,
  publicExcludes: ['sw-dev.js'],
  workboxOptions: {
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    inlineWorkboxRuntime: true,
    navigateFallback: OFFLINE_FALLBACK,
    navigateFallbackDenylist: [/^\/api\//],
    additionalManifestEntries: PRECACHE_MANIFEST_ENTRIES,
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
      },
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
            maxAgeSeconds: DAY * 7,
          },
          matchOptions: {
            ignoreVary: true,
          },
        },
      },
      {
        urlPattern: ({ url }) => url.origin === 'https://lh3.googleusercontent.com',
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'remote-images',
          expiration: {
            maxEntries: 24,
            maxAgeSeconds: DAY * 7,
          },
        },
      },
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/_next/static/'),
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'next-static-assets',
        },
      },
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
            maxAgeSeconds: DAY * 30,
          },
        },
      },
    ],
  },
})(nextConfig);
