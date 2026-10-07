'use client'

import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  LogOut,
  MessageSquare,
  MoreVertical,
  Pencil,
  Plug,
  PlugZap,
  QrCode,
  Trash2,
  Unplug,
} from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SessionStatusBadge } from '@/components/session-status-badge'
import { api } from '@/lib/fetcher'
import type { SessionWithStats } from '@/lib/types'
import { cn, formatDateTime } from '@/lib/utils'

interface Props {
  session: SessionWithStats
  onChanged: () => void
  onDeleted: () => void
}

export function SessionCard({ session, onChanged, onDeleted }: Props) {
  const [busy, setBusy] = React.useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [renameOpen, setRenameOpen] = React.useState(false)
  const [name, setName] = React.useState(session.name)
  const [confirmLogout, setConfirmLogout] = React.useState(false)

  const { data } = useSWR<{ url: string | null }>(
    session.status === 'connected' ? `/api/sessions/${session.id}/avatar` : null,
    { revalidateOnFocus: false, dedupingInterval: 300000 },
  )

  async function run(action: string, fn: () => Promise<unknown>, successMessage: string) {
    setBusy(action)
    try {
      await fn()
      toast.success(successMessage)
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="card-hover group relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[#25D366]/10 blur-2xl transition-opacity group-hover:opacity-80" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            name={session.pushName || session.name}
            src={session.status === 'connected' ? data?.url : null}
            size="md"
            ring={session.status === 'connected'}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold">{session.name}</h3>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              +{session.phoneNumber}
              {session.pushName ? ` · ${session.pushName}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <SessionStatusBadge status={session.status} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="iconSm" aria-label="Session actions">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Session</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                <Pencil className="h-4 w-4" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  run(
                    'connect',
                    () => api.post(`/api/sessions/${session.id}/connect`),
                    'Reconnecting session…',
                  )
                }
              >
                <PlugZap className="h-4 w-4" /> Reconnect
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  run(
                    'disconnect',
                    () => api.post(`/api/sessions/${session.id}/disconnect`),
                    'Session disconnected',
                  )
                }
              >
                <Unplug className="h-4 w-4" /> Disconnect
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-amber-300 focus:text-amber-200"
                onSelect={() => setConfirmLogout(true)}
              >
                <LogOut className="h-4 w-4" /> Logout / unlink
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-300 focus:text-red-200"
                onSelect={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" /> Delete session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {session.lastError && (
        <p className="mt-3 line-clamp-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2 text-[11px] text-amber-200">
          {session.lastError}
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Chats" value={session.stats.chats} />
        <Stat label="Messages" value={session.stats.messages} />
        <Stat label="Unread" value={session.stats.unread} highlight={session.stats.unread > 0} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {session.status === 'connected' ? (
          <>
            <Button asChild size="sm" className="flex-1">
              <Link href={`/chat/${session.id}`}>
                <MessageSquare /> Open chats
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/pair?session=${session.id}`}>
                <QrCode /> Code
              </Link>
            </Button>
          </>
        ) : session.status === 'pairing' ? (
          <Button asChild size="sm" className="flex-1">
            <Link href={`/pair?session=${session.id}`}>
              <QrCode /> Show pairing code
            </Link>
          </Button>
        ) : (
          <>
            <Button asChild size="sm" className="flex-1">
              <Link href={`/pair?session=${session.id}`}>
                <QrCode /> Pair this number
              </Link>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={busy === 'connect'}
              onClick={() =>
                run(
                  'connect',
                  () => api.post(`/api/sessions/${session.id}/connect`),
                  'Connecting…',
                )
              }
            >
              <Plug /> Reconnect
            </Button>
          </>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>Created {formatDateTime(session.createdAt)}</span>
        {session.connectedAt && (
          <span className={cn('flex items-center gap-1 text-[#4ade80]')}>
            <span className="h-1 w-1 rounded-full bg-[#25D366]" />
            up since {formatDateTime(session.connectedAt)}
          </span>
        )}
      </div>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename session</DialogTitle>
            <DialogDescription>Only changes the label inside this panel.</DialogDescription>
          </DialogHeader>
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={busy === 'rename'}
              onClick={async () => {
                await run(
                  'rename',
                  () => api.patch(`/api/sessions/${session.id}`, { name }),
                  'Session renamed',
                )
                setRenameOpen(false)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logout confirmation */}
      <ConfirmDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="Logout & unlink device?"
        description="The device will be unlinked on WhatsApp. You will need a new pairing code to reconnect this number. Chat history stays in this panel."
        confirmLabel="Logout"
        busy={busy === 'logout'}
        onConfirm={async () => {
          await run('logout', () => api.post(`/api/sessions/${session.id}/logout`), 'Session unlinked')
          setConfirmLogout(false)
        }}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this session?"
        description="This removes the session, all stored chats, messages and downloaded media from the server. The WhatsApp account itself is not affected until you also logout."
        confirmLabel="Delete everything"
        busy={busy === 'delete'}
        onConfirm={async () => {
          await api
            .delete(`/api/sessions/${session.id}`)
            .then(() => {
              toast.success('Session deleted')
              setConfirmDelete(false)
              onDeleted()
            })
            .catch((error: unknown) =>
              toast.error(error instanceof Error ? error.message : 'Delete failed'),
            )
        }}
      />
    </Card>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-2',
        highlight && 'border-[#25D366]/25 bg-[#25D366]/[0.08]',
      )}
    >
      <div className={cn('text-sm font-semibold tabular-nums', highlight && 'text-[#4ade80]')}>
        {value.toLocaleString()}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  )
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  busy,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void | Promise<void>
  busy?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" loading={busy} onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
