'use client'

import * as React from 'react'
import Link from 'next/link'
import { Activity, BookOpen, Plus, QrCode, RefreshCw, ShieldCheck, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { AddSessionDialog } from '@/components/dashboard/add-session-dialog'
import { SessionCard } from '@/components/dashboard/session-card'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { refreshLists, useSessions, useStats } from '@/hooks/use-api'
import { useSocketEvent } from '@/hooks/use-socket'

const FEATURES = [
  {
    icon: QrCode,
    title: 'Pairing code login',
    text: 'Enter a number, get an 8-digit code, type it on the phone. No QR scanning needed.',
  },
  {
    icon: Zap,
    title: 'Realtime everything',
    text: 'Incoming & outgoing messages stream instantly over Socket.io — no refresh.',
  },
  {
    icon: ShieldCheck,
    title: 'Multi-device sessions',
    text: 'Connect several numbers at once, each with its own auth state and reconnect logic.',
  },
]

export default function DashboardPage() {
  const { sessions, isLoading, mutate } = useSessions()
  const { stats, mutate: mutateStats } = useStats()

  const refresh = React.useCallback(() => {
    void mutate()
    void mutateStats()
  }, [mutate, mutateStats])

  // Live updates: a session changed status somewhere else in the app.
  useSocketEvent('session:status', (payload) => {
    refresh()
    if (payload.status === 'connected') {
      toast.success('WhatsApp connected 🎉', { description: payload.phoneNumber })
    }
  })

  useSocketEvent('sessions:changed', () => refresh())
  useSocketEvent('session:deleted', () => refresh())
  useSocketEvent('session:created', () => refresh())

  const connected = sessions.filter((session) => session.status === 'connected').length
  const totalUnread = sessions.reduce((sum, session) => sum + session.stats.unread, 0)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-br from-white/[0.05] via-transparent to-transparent p-6 md:p-9">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#25D366]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-[#128C7E]/15 blur-3xl" />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#25D366]/25 bg-[#25D366]/10 px-3 py-1 text-[11px] font-medium text-[#4ade80]">
                <Activity className="h-3 w-3" /> {connected} of {sessions.length || 0} sessions online
              </span>
              {totalUnread > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-[11px] font-medium text-sky-300">
                  {totalUnread} unread message{totalUnread > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
              WhatsApp <span className="gradient-text">Multi-Device</span> Controller
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              Link numbers with a pairing code, read every conversation in realtime and send text,
              photos, videos, documents and voice notes — all from one self-hosted dashboard running
              on a single service.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <AddSessionDialog
                trigger={
                  <Button size="lg">
                    <Plus /> Add New Number
                  </Button>
                }
              />
              <Button variant="secondary" size="lg" asChild>
                <Link href="/pair">
                  <QrCode /> Pairing page
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => {
                  refreshLists()
                  refresh()
                  toast.success('Refreshed')
                }}
              >
                <RefreshCw /> Refresh
              </Button>
            </div>
          </div>

          <Card className="w-full max-w-xs shrink-0 bg-black/20 p-4 md:w-72">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              How it works
            </div>
            <ol className="mt-3 space-y-3 text-xs text-muted-foreground">
              {[
                'Add the phone number (international format)',
                'Tap “Generate Pairing Code”',
                'WhatsApp → Linked devices → Link with phone number',
                'Type the code → session goes online instantly',
              ].map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15 text-[10px] font-semibold text-[#4ade80]">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-6">
        <StatsCards stats={stats} />
      </section>

      {/* Sessions */}
      <section id="sessions" className="mt-10 scroll-mt-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Your sessions</h2>
            <p className="text-xs text-muted-foreground">
              Every number you link lives here with its own realtime status.
            </p>
          </div>
          <AddSessionDialog
            trigger={
              <Button variant="secondary" size="sm">
                <Plus /> New
              </Button>
            }
          />
        </div>

        {isLoading && sessions.length === 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((key) => (
              <Skeleton key={key} className="h-56 w-full" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-4 border-dashed py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#25D366]/10">
              <QrCode className="h-6 w-6 text-[#25D366]" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">No session yet</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Add your first WhatsApp number and link it with a pairing code in under a minute.
              </p>
            </div>
            <AddSessionDialog />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onChanged={refresh}
                onDeleted={refresh}
              />
            ))}
          </div>
        )}
      </section>

      {/* Features */}
      <section className="mt-12 grid gap-4 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.title} className="card-hover p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366]/10">
              <feature.icon className="h-5 w-5 text-[#25D366]" />
            </div>
            <h3 className="mt-4 font-semibold">{feature.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
          </Card>
        ))}
      </section>

      <footer className="mt-12 flex flex-col items-center gap-3 border-t border-white/[0.06] pt-6 text-center text-xs text-muted-foreground md:flex-row md:justify-between md:text-left">
        <p>
          Not affiliated with WhatsApp Inc. Use responsibly — no bulk or unsolicited messaging.
        </p>
        <Link href="/docs" className="inline-flex items-center gap-1.5 hover:text-foreground">
          <BookOpen className="h-3.5 w-3.5" /> Local + Railway setup guide
        </Link>
      </footer>
    </div>
  )
}
