'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSWRConfig } from 'swr'
import { ChevronLeft, Radio, TriangleAlert } from 'lucide-react'
import { ChatList } from '@/components/chat/chat-list'
import { Conversation } from '@/components/chat/conversation'
import { SessionStatusBadge } from '@/components/session-status-badge'
import { Button } from '@/components/ui/button'
import { useChats, useMessages, useSession } from '@/hooks/use-api'
import { useOpenChat, useSessionRoom, useSocket, useSocketEvent } from '@/hooks/use-socket'
import type { ChatDTO, MessageDTO } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function ChatPage({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeChatId = searchParams.get('chat')
  const { mutate: globalMutate } = useSWRConfig()

  const { session } = useSession(sessionId)
  const { chats, isLoading: chatsLoading, mutate: mutateChats } = useChats(sessionId)
  const { socket } = useSocket()
  const {
    messages,
    chat: activeChat,
    isLoading: messagesLoading,
    mutate: mutateMessages,
  } = useMessages(activeChatId ?? undefined)

  useSessionRoom(sessionId)
  useOpenChat(activeChatId ?? undefined)

  const selectChat = React.useCallback(
    (chatId: string) => {
      const query = new URLSearchParams(searchParams.toString())
      query.set('chat', chatId)
      router.replace(`/chat/${sessionId}?${query.toString()}`, { scroll: false })
    },
    [router, searchParams, sessionId],
  )

  const closeChat = React.useCallback(() => {
    const query = new URLSearchParams(searchParams.toString())
    query.delete('chat')
    const qs = query.toString()
    router.replace(qs ? `/chat/${sessionId}?${qs}` : `/chat/${sessionId}`, { scroll: false })
  }, [router, searchParams, sessionId])

  // Auto-select the most recent chat on wide screens.
  React.useEffect(() => {
    if (activeChatId || chats.length === 0) return
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      selectChat(chats[0].id)
    }
  }, [activeChatId, chats, selectChat])

  /* ---------------------------- realtime wiring --------------------------- */

  const chatsKey = React.useMemo(() => `/api/sessions/${sessionId}/chats?`, [sessionId])
  const messagesKey = React.useMemo(
    () => (activeChatId ? `/api/chats/${activeChatId}/messages?limit=60` : null),
    [activeChatId],
  )

  useSocketEvent('session:message', (payload) => {
    if (payload.sessionId !== sessionId) return

    // 1. chat list: reorder + update preview / unread badge
    void globalMutate(
      chatsKey,
      (current?: { chats: ChatDTO[] }) => {
        if (!current) return current
        const others = current.chats.filter((chat) => chat.id !== payload.chat.id)
        return { chats: [payload.chat, ...others] }
      },
      { revalidate: true },
    )

    // 2. open conversation: append the new bubble instantly
    if (messagesKey && payload.message.chatId === activeChatId) {
      void globalMutate(
        messagesKey,
        (current?: { messages: MessageDTO[]; chat: ChatDTO }) => {
          if (!current) return current
          if (current.messages.some((message) => message.id === payload.message.id)) return current
          return { ...current, messages: [...current.messages, payload.message] }
        },
        { revalidate: false },
      )
    }
  })

  useSocketEvent('session:chat', (payload) => {
    if (payload.sessionId !== sessionId) return
    void globalMutate(chatsKey)
  })

  useSocketEvent('session:message-status', (payload) => {
    if (payload.sessionId !== sessionId) return
    const key = `/api/chats/${payload.chatId}/messages?limit=60`
    void globalMutate(
      key,
      (current?: { messages: MessageDTO[]; chat: ChatDTO }) => {
        if (!current) return current
        return {
          ...current,
          messages: current.messages.map((message) =>
            message.waMessageId === payload.waMessageId
              ? { ...message, status: payload.status }
              : message,
          ),
        }
      },
      { revalidate: false },
    )
  })

  /* -------------------------------- render -------------------------------- */

  const offline = session && session.status !== 'connected'

  return (
    <div className="flex h-dvh min-h-0 flex-col md:flex-row">
      {/* Mobile session strip */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[hsl(200_25%_5%)]/80 px-3 py-2 backdrop-blur md:hidden">
        <Button asChild variant="ghost" size="iconSm">
          <Link href="/" aria-label="Back to dashboard">
            <ChevronLeft />
          </Link>
        </Button>
        <span className="truncate text-sm font-medium">{session?.name ?? 'Session'}</span>
        {session && <SessionStatusBadge status={session.status} className="ml-auto" />}
      </div>

      {offline && (
        <div className="flex items-center gap-2 border-b border-amber-400/20 bg-amber-400/[0.08] px-4 py-2 text-xs text-amber-200 md:hidden">
          <TriangleAlert className="h-3.5 w-3.5" />
          Session is {session?.status}. Sending is disabled until it reconnects.
        </div>
      )}

      <div className={cn('flex min-h-0 flex-1', activeChatId ? 'hidden md:flex' : 'flex', 'md:w-[340px] md:flex-none')}>
        <div className="flex h-full w-full min-h-0 flex-col">
          <div className="hidden items-center gap-2 border-b border-white/[0.06] bg-[hsl(200_25%_5%)]/80 px-4 py-3 md:flex">
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
              ← Dashboard
            </Link>
            <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
              <Radio className="h-3 w-3 text-[#25D366]" />
              {session?.name ?? 'Session'}
            </span>
          </div>
          <ChatList
            sessionId={sessionId}
            chats={chats}
            isLoading={chatsLoading}
            activeChatId={activeChatId}
            onSelect={selectChat}
            onChanged={() => {
              void mutateChats()
            }}
          />
        </div>
      </div>

      <div className={cn('min-h-0 flex-1', activeChatId ? 'flex' : 'hidden md:flex')}>
        <Conversation
          sessionId={sessionId}
          sessionLabel={session?.name ?? 'session'}
          chat={activeChat ?? null}
          messages={messages}
          isLoading={messagesLoading}
          onBack={closeChat}
          onChanged={() => {
            void mutateMessages()
            void mutateChats()
          }}
          onTyping={(state) => {
            if (!activeChatId) return
            socket?.emit('chat:typing', { sessionId, chatId: activeChatId, state })
          }}
        />
      </div>
    </div>
  )
}
