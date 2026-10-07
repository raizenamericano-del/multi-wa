'use client'

import * as React from 'react'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@/lib/types'

export type AppClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH || '/api/socket/io'

interface SocketContextValue {
  socket: AppClientSocket | null
  connected: boolean
}

const SocketContext = React.createContext<SocketContextValue>({ socket: null, connected: false })

/**
 * Single Socket.io connection shared by the whole dashboard.
 * Connects to the same origin (Railway proxies both HTTP + websockets to the
 * one service), so no URL needs to be configured.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = React.useState<AppClientSocket | null>(null)
  const [connected, setConnected] = React.useState(false)

  React.useEffect(() => {
    const instance: AppClientSocket = io({
      path: SOCKET_PATH,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    })

    instance.on('connect', () => setConnected(true))
    instance.on('disconnect', () => setConnected(false))
    instance.on('connect_error', () => setConnected(false))

    setSocket(instance)
    return () => {
      instance.removeAllListeners()
      instance.disconnect()
    }
  }, [])

  const value = React.useMemo(() => ({ socket, connected }), [socket, connected])
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export function useSocket() {
  return React.useContext(SocketContext)
}

/** Subscribe to a socket event with a stable handler reference. */
export function useSocketEvent<E extends keyof ServerToClientEvents>(
  event: E,
  handler: (...args: Parameters<ServerToClientEvents[E]>) => void,
  enabled = true,
) {
  const { socket } = useSocket()
  const handlerRef = React.useRef(handler)

  React.useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  React.useEffect(() => {
    if (!socket || !enabled) return
    const listener = (...args: Parameters<ServerToClientEvents[E]>) => handlerRef.current(...args)
    socket.on(event, listener as never)
    return () => {
      socket.off(event, listener as never)
    }
  }, [socket, event, enabled])
}

/** Join/leave the room of a session so we only receive its events. */
export function useSessionRoom(sessionId?: string) {
  const { socket, connected } = useSocket()

  React.useEffect(() => {
    if (!socket || !connected || !sessionId) return
    socket.emit('subscribe', { sessionId })
    return () => {
      socket.emit('unsubscribe', { sessionId })
    }
  }, [socket, connected, sessionId])
}

/** Let the server know a chat is on screen (auto read receipts / unread count). */
export function useOpenChat(chatId?: string) {
  const { socket, connected } = useSocket()

  React.useEffect(() => {
    if (!socket || !connected || !chatId) return
    socket.emit('chat:open', { chatId })
    return () => {
      socket.emit('chat:close', { chatId })
    }
  }, [socket, connected, chatId])
}
