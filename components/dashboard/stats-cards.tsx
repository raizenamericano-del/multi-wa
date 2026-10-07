'use client'

import { Inbox, MessageSquareText, Radio, Smartphone, ImageIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { StatsDTO } from '@/lib/types'

const ITEMS = [
  { key: 'sessions', label: 'Total Sessions', icon: Smartphone, tint: 'from-[#25D366]/25' },
  { key: 'connected', label: 'Connected', icon: Radio, tint: 'from-emerald-400/25' },
  { key: 'chats', label: 'Chats', icon: Inbox, tint: 'from-sky-400/25' },
  { key: 'messages', label: 'Messages', icon: MessageSquareText, tint: 'from-violet-400/25' },
  { key: 'media', label: 'Media files', icon: ImageIcon, tint: 'from-amber-400/25' },
] as const

export function StatsCards({ stats }: { stats: StatsDTO | null }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {ITEMS.map((item) => {
        const value = stats ? stats[item.key as keyof StatsDTO] : null
        return (
          <Card key={item.key} className="card-hover relative overflow-hidden p-4">
            <div
              className={`pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${item.tint} to-transparent blur-xl`}
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {item.label}
              </span>
              <item.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 text-2xl font-semibold tabular-nums">
              {value === null ? <Skeleton className="h-7 w-12" /> : value.toLocaleString()}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
