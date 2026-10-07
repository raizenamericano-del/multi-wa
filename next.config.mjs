/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // We run a custom server (server.ts) for Socket.io + Baileys, so Next must
  // not try to bundle the long-lived native/server-only dependencies.
  experimental: {
    serverComponentsExternalPackages: [
      '@whiskeysockets/baileys',
      '@prisma/client',
      'prisma',
      'pino',
      'socket.io',
    ],
  },

  // Streaming uploads of media (images/videos/voice notes) go through a
  // Route Handler, so we only need to keep the body size generous there.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'pps.whatsapp.net' },
      { protocol: 'https', hostname: 'mmg.whatsapp.net' },
      { protocol: 'https', hostname: 'web.whatsapp.com' },
    ],
  },
}

export default nextConfig
