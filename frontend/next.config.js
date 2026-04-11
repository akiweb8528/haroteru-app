/** @type {import('next').NextConfig} */
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

module.exports = nextConfig;
