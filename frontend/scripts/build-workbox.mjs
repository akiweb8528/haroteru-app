import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSW } from 'workbox-build';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const buildDirectory = path.join(projectRoot, '.next');
const publicDirectory = path.join(projectRoot, 'public');
const swDest = path.join(publicDirectory, 'sw.js');
const offlineFallbackPath = path.join(publicDirectory, 'offline.html');

async function buildRevision(filePath) {
  const file = await fs.readFile(filePath);
  return createHash('sha256').update(file).digest('hex');
}

const offlineFallbackRevision = await buildRevision(offlineFallbackPath);

const { count, size, warnings } = await generateSW({
  globDirectory: buildDirectory,
  globPatterns: [
    'static/**/*.{js,css,woff,woff2,ttf,eot,png,svg,jpg,jpeg,gif,webp,avif,ico}',
  ],
  swDest,
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: false,
  inlineWorkboxRuntime: true,
  navigateFallback: '/offline.html',
  navigateFallbackDenylist: [/^\/api\//],
  additionalManifestEntries: [
    { url: '/offline.html', revision: offlineFallbackRevision },
  ],
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        networkTimeoutSeconds: 3,
      },
    },
    {
      urlPattern: ({ url }) => url.origin === 'https://lh3.googleusercontent.com',
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'remote-images',
        expiration: {
          maxEntries: 24,
          maxAgeSeconds: 60 * 60 * 24 * 7,
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
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
  ],
});

if (warnings.length > 0) {
  for (const warning of warnings) {
    console.warn(`[workbox] ${warning}`);
  }
}

console.log(`[workbox] Generated ${path.relative(projectRoot, swDest)} with ${count} precached URLs (${size} bytes).`);
