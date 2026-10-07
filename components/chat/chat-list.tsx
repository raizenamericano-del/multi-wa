'use client'

import * as React from 'react'
import { Loader2, MessageSquarePlus, Pin, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/fetcher'
import type { ChatDTO } from '@/lib/types'
import { cn, formatChatTimestamp, formatPhoneNumber, truncate } from '@/lib/utils'

interface Props {
  sessionId: string
  chats: ChatDTO[]
  isLoading: boolean
  activeChatId: string | null
  onSelect: (chatId: string) => void
  onChanged: () => void
}

export function ChatList({
  sessionId,
  chats,
  isLoading,
  activeChatId,
  onSelect,
  onChanged,
}: Props) {
  const [search, setSearch] = React.useState('')
  const [newOpen, setNewOpen] = React.useState(false)
  const [phoneNumber, setPhoneNumber] = React.useState('')
  const [creating, setCreating] = React.useState(false)

  const filtered = React.useMemo(() => {
    if (!search.trim()) return chats
    const needle = search.toLowerCase()
    return chats.filter(
      (chat) =>
        (chat.name ?? '').toLowerCase().includes(needle) ||
        chat.jid.toLowerCase().includes(needle) ||
        (chat.lastMessagePreview ?? '').toLowerCase().includes(needle),
    )
  }, [chats, search])

  async function openByNumber() {
    setCreating(true)
    try {
      const { chat } = await api.post<{ chat: ChatDTO }>(`/api/sessions/${sessionId}/chats`, {
        phoneNumber,
      })
      toast.success('Chat ready', { description: chat.name ?? chat.jid })
      setNewOpen(false)
      setPhoneNumber('')
      onChanged()
      onSelect(chat.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open that number')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-white/[0.06] bg-[hsl(200_25%_5%)]/60">
      <div className="space-y-3 border-b border-white/[0.06] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Chats</h2>
          <Button variant="secondary" size="sm" onClick={() => setNewOpen(true)}>
            <MessageSquarePlus /> New
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or number…"
            className="h-10 pl-9"
          />
        </div>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {isLoading && chats.length === 0 ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3, 4].map((key) => (
              <Skeleton key={key} className="h-16 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <MessageSquarePlus className="h-6 w-6 opacity-60" />
            {chats.length === 0
              ? 'No conversations yet. Incoming messages will appear here instantly.'
              : 'No chat matches your search.'}
          </div>
        ) : (
          filtered.map((chat) => {
            const isActive = chat.id === activeChatId
            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => onSelect(chat.id)}
                className={cn(
                  'flex w-full items-center gap-3 border-b border-white/[0.03] px-4 py-3 text-left transition-colors',
                  isActive ? 'bg-[#25D366]/[0.08]' : 'hover:bg-white/[0.03]',
                )}
              >
                <Avatar name={chat.name ?? chat.jid} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                      {chat.pinned && <Pin className="h-3 w-3 text-[#25D366]" />}
                      {chat.isGroup && <Users className="h-3 w-3 text-muted-foreground" />}
                      <span className="truncate">
                        {chat.name || formatPhoneNumber(chat.jid)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatChatTimestamp(chat.lastMessageAt)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {truncate(chat.lastMessagePreview || 'No messages yet', 42)}
                    </span>
                    {chat.unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[10px] font-semibold text-[#04150f]">
                        {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start a new chat</DialogTitle>
            <DialogDescription>
              Enter the destination number in international format (without <code>+</code>).
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={phoneNumber}
            inputMode="numeric"
            placeholder="6281234567890"
            onChange={(event) => setPhoneNumber(event.target.value.replace(/[^\d+]/g, ''))}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={openByNumber} loading={creating} disabled={phoneNumber.length < 8}>
              {creating ? <Loader2 className="animate-spin" /> : null} Open chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
