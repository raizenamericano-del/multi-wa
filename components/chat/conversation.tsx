'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  Archive,
  ArrowLeft,
  CheckCheck,
  Download,
  Loader2,
  MoreVertical,
  RefreshCw,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageBubble } from '@/components/chat/message-bubble'
import { MessageComposer } from '@/components/chat/message-composer'
import { api } from '@/lib/fetcher'
import type { ChatDTO, MessageDTO } from '@/lib/types'
import { cn, dayLabel, formatPhoneNumber } from '@/lib/utils'

interface Props {
  sessionId: string
  sessionLabel: string
  chat: ChatDTO | null
  messages: MessageDTO[]
  isLoading: boolean
  onBack: () => void
  onChanged: () => void
  onTyping: (state: 'composing' | 'paused') => void
}

export function Conversation({
  sessionId,
  sessionLabel,
  chat,
  messages,
  isLoading,
  onBack,
  onChanged,
  onTyping,
}: Props) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const bottomRef = React.useRef<HTMLDivElement | null>(null)
  const [lightbox, setLightbox] = React.useState<MessageDTO | null>(null)
  const [sendingRefresh, setSendingRefresh] = React.useState(false)

  const { data: avatar } = useSWR<{ url: string | null }>(
    chat ? `/api/sessions/${sessionId}/avatar?jid=${encodeURIComponent(chat.jid)}` : null,
    { dedupingInterval: 300000, revalidateOnFocus: false },
  )

  // Auto-scroll to the newest message.
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, chat?.id])

  const grouped = React.useMemo(() => {
    const groups: { day: string; items: MessageDTO[] }[] = []
    for (const message of messages) {
      const label = dayLabel(message.timestamp)
      const last = groups[groups.length - 1]
      if (last && last.day === label) last.items.push(message)
      else groups.push({ day: label, items: [message] })
    }
    return groups
  }, [messages])

  if (!chat) {
    return (
      <div className="hidden flex-1 flex-col items-center justify-center gap-3 p-10 text-center md:flex">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04]">
          <Users className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">Select a conversation</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Pick a chat on the left, or start a new one with the number of your choice. Anything that
          arrives while you are here appears instantly.
        </p>
      </div>
    )
  }

  const title = chat.name || formatPhoneNumber(chat.jid)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-white/[0.06] bg-[hsl(200_25%_5%)]/80 px-3 py-2.5 backdrop-blur md:px-4">
        <Button variant="ghost" size="iconSm" className="md:hidden" onClick={onBack} aria-label="Back">
          <ArrowLeft />
        </Button>
        <Avatar name={title} src={avatar?.url ?? null} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {chat.isGroup && <Users className="h-3 w-3 text-muted-foreground" />}
            <h2 className="truncate text-sm font-semibold">{title}</h2>
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {chat.isGroup ? 'Group' : `+${chat.jid.split('@')[0]}`} · via {sessionLabel}
          </p>
        </div>

        <Button
          variant="ghost"
          size="iconSm"
          aria-label="Reload messages"
          onClick={() => {
            setSendingRefresh(true)
            onChanged()
            setTimeout(() => setSendingRefresh(false), 600)
          }}
        >
          {sendingRefresh ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="iconSm" aria-label="Chat actions">
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={async () => {
                await api.patch(`/api/chats/${chat.id}`, { read: true }).catch(() => undefined)
                toast.success('Marked as read')
                onChanged()
              }}
            >
              <CheckCheck className="h-4 w-4" /> Mark as read
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={async () => {
                await api
                  .patch(`/api/chats/${chat.id}`, { pinned: !chat.pinned })
                  .then(() => toast.success(chat.pinned ? 'Unpinned' : 'Pinned'))
                  .catch(() => toast.error('Could not update chat'))
                onChanged()
              }}
            >
              📌 {chat.pinned ? 'Unpin' : 'Pin'} chat
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={async () => {
                await api
                  .patch(`/api/chats/${chat.id}`, { archived: true })
                  .then(() => toast.success('Chat archived'))
                  .catch(() => toast.error('Could not archive chat'))
                onBack()
                onChanged()
              }}
            >
              <Archive className="h-4 w-4" /> Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="chat-wallpaper scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6">
        {isLoading && messages.length === 0 ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((key) => (
              <Skeleton key={key} className={cn('h-14 w-2/3', key % 2 ? 'ml-auto' : '')} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-2xl border border-white/[0.06] bg-black/30 px-5 py-4 text-center text-sm text-muted-foreground">
              No messages yet in this chat.
              <br />
              Say hi 👋
            </div>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.day} className="space-y-2">
              <div className="sticky top-0 z-10 flex justify-center py-2">
                <span className="rounded-full border border-white/[0.06] bg-black/50 px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur">
                  {group.day}
                </span>
              </div>
              {group.items.map((message, index) => {
                const previous = group.items[index - 1]
                const showSender =
                  chat.isGroup &&
                  !message.fromMe &&
                  (!previous || previous.senderJid !== message.senderJid)
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    showSender={showSender}
                    onOpenMedia={setLightbox}
                  />
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <MessageComposer
        sessionId={sessionId}
        chatId={chat.id}
        onSent={onChanged}
        onTyping={onTyping}
      />

      {/* Lightbox */}
      <Dialog open={Boolean(lightbox)} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-4xl border-none bg-black/90 p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Media preview</DialogTitle>
            <DialogDescription>Full size preview of the selected media</DialogDescription>
          </DialogHeader>
          {lightbox && (
            <div className="flex flex-col items-center gap-3">
              {lightbox.type === 'video' ? (
                <video
                  src={`/api/media?id=${lightbox.id}`}
                  controls
                  autoPlay
                  className="max-h-[75vh] w-full rounded-xl"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/media?id=${lightbox.id}`}
                  alt={lightbox.text ?? 'media'}
                  className="max-h-[75vh] w-auto rounded-xl object-contain"
                />
              )}
              {lightbox.text && (
                <p className="max-w-2xl text-center text-sm text-white/80">{lightbox.text}</p>
              )}
              <div className="flex gap-2">
                <Button asChild variant="secondary" size="sm">
                  <a href={`/api/media?id=${lightbox.id}&download=1`} target="_blank" rel="noreferrer">
                    <Download /> Download
                  </a>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setLightbox(null)}>
                  <X /> Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
