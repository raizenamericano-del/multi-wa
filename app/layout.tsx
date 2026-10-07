import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AppShell } from '@/components/layout/app-shell'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: 'WA Multi-Device Controller',
  description:
    'Self-hosted WhatsApp Multi-Device control panel — pairing codes, realtime chats, media & voice notes. Built with Next.js, Baileys, Socket.io and Prisma.',
  keywords: ['whatsapp', 'baileys', 'multi-device', 'next.js', 'socket.io'],
  manifest: '/manifest.webmanifest',
  authors: [{ name: 'WA Controller' }],
  icons: {
    icon: [
      {
        url:
          'data:image/svg+xml,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#128C7E"/><path fill="#25D366" d="M16 6C10.5 6 6 10.5 6 16c0 1.9.5 3.7 1.5 5.3L6 27l5.9-1.5c1.5.9 3.3 1.4 5.1 1.4 5.5 0 10-4.5 10-10S21.5 6 16 6Z"/></svg>',
          ),
      },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0f14',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
