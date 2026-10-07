'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpen,
  LayoutDashboard,
  MessagesSquare,
  QrCode,
  Radio,
  Server,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSocket } from '@/hooks/use-socket'

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pair', label: 'Pair Device', icon: QrCode },
  { href: '/docs', label: 'Guide', icon: BookOpen },
]

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-[0_10px_30px_-10px_rgba(37,211,102,0.9)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#04150f]" fill="currentColor">
          <path d="M12.04 2C7.58 2 4 5.58 4 10.04c0 1.42.37 2.8 1.07 4.02L4 22l8.13-1.05c1.18.63 2.5.96 3.91.96 4.46 0 8.04-3.58 8.04-8.04C24.08 5.58 20.5 2 16.04 2h-4Z" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight">WA Controller</div>
        <div className="text-[11px] text-muted-foreground">Multi-Device Panel</div>
      </div>
    </div>
  )
}

function SocketIndicator({ compact = false }: { compact?: boolean }) {
  const { connected } = useSocket()
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px]',
        connected
          ? 'border-[#25D366]/25 bg-[#25D366]/10 text-[#4ade80]'
          : 'border-amber-400/25 bg-amber-400/10 text-amber-300',
      )}
    >
      <Radio className={cn('h-3.5 w-3.5', connected && 'animate-pulse')} />
      {compact ? null : <span>{connected ? 'Realtime connected' : 'Reconnecting…'}</span>}
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isChatRoute = pathname?.startsWith('/chat')

  return (
    <div className="flex min-h-dvh w-full">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[252px] shrink-0 flex-col justify-between border-r border-white/[0.06] bg-[hsl(200_25%_5%)]/70 px-4 py-6 backdrop-blur-xl md:flex">
        <div className="space-y-8">
          <Link href="/" className="block">
            <Logo />
          </Link>

          <nav className="space-y-1">
            {NAV.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
                    active
                      ? 'bg-gradient-to-r from-[#25D366]/16 to-transparent text-foreground shadow-[inset_0_0_0_1px_rgba(37,211,102,0.22)]'
                      : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
                  )}
                >
                  <item.icon
                    className={cn('h-4 w-4', active ? 'text-[#25D366]' : 'text-muted-foreground')}
                  />
                  {item.label}
                </Link>
              )
            })}
            <Link
              href="/#sessions"
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-all hover:bg-white/[0.04] hover:text-foreground"
            >
              <MessagesSquare className="h-4 w-4" />
              Sessions
            </Link>
          </nav>
        </div>

        <div className="space-y-3">
          <SocketIndicator />
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-muted-foreground">
            <div className="mb-1 flex items-center gap-1.5 text-foreground/80">
              <Server className="h-3.5 w-3.5" /> Single service deploy
            </div>
            Next.js · Baileys · Socket.io · Prisma
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar (hidden on chat page which has its own header) */}
        {!isChatRoute && (
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-[hsl(200_25%_5%)]/80 px-4 py-3 backdrop-blur-xl md:hidden">
            <Logo />
            <SocketIndicator compact />
          </header>
        )}

        <main className="min-w-0 flex-1">{children}</main>

        {/* Mobile bottom nav */}
        {!isChatRoute && (
          <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-white/[0.06] bg-[hsl(200_25%_5%)]/95 px-2 py-2 backdrop-blur-xl md:hidden">
            {NAV.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] transition-colors',
                    active ? 'text-[#25D366]' : 'text-muted-foreground',
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        )}
      </div>
    </div>
  )
}
