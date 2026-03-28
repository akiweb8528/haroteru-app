/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
