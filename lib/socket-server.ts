import type { Server as HttpServer } from 'node:http'
import { Server as IOServer, type Socket } from 'socket.io'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@/lib/types'

export type AppIOServer = IOServer<ClientToServerEvents, ServerToClientEvents>
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>

export const SOCKET_PATH = process.env.SOCKET_PATH || '/api/socket/io'

/**
 * The Socket.io server instance is kept on globalThis on purpose.
 *
 * With a custom server (server.ts) + Next.js App Router, the route handlers are
 * bundled by Next into their own module graph. A plain module-scope singleton
 * would therefore be duplicated and the route handlers would talk to a *second*,
 * useless copy of the server. globalThis is shared by every module graph inside
 * the same Node process, so this is the safe place for process-wide singletons.
 */
const globalStore = globalThis as unknown as {
  __waIO?: AppIOServer
  __waNextServer?: HttpServer
}

export function setIO(io: AppIOServer) {
  globalStore.__waIO = io
}

export function getIO(): AppIOServer | null {
  return globalStore.__waIO ?? null
}

export function setHttpServer(server: HttpServer) {
  globalStore.__waNextServer = server
}

export function getHttpServer(): HttpServer | null {
  return globalStore.__waNextServer ?? null
}

/** Emit an event to everybody watching a specific session. */
export function emitToSession<E extends keyof ServerToClientEvents>(
  sessionId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
) {
  getIO()?.to(`session:${sessionId}`).emit(event, ...args)
}

/** Emit an event to every connected dashboard client. */
export function broadcast<E extends keyof ServerToClientEvents>(
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
) {
  getIO()?.emit(event, ...args)
}

/**
 * Wire the Socket.io gateway: room management + client -> server commands
 * (presence / read receipts are forwarded to the matching Baileys session).
 */
export async function registerSocketGateway(io: AppIOServer) {
  setIO(io)

  // Late import: avoids a circular dependency between the gateway and the
  // session manager (the manager itself imports socket helpers).
  const { sessionManager } = await import('@/lib/baileys/session-manager')

  io.on('connection', (socket) => {
    socket.emit('server:ready', { at: new Date().toISOString() })
    socket.join('all')

    socket.on('subscribe', ({ sessionId } = {}) => {
      if (sessionId) void socket.join(`session:${sessionId}`)
    })

    socket.on('unsubscribe', ({ sessionId } = {}) => {
      if (sessionId) void socket.leave(`session:${sessionId}`)
    })

    socket.on('chat:typing', async ({ sessionId, chatId, state }) => {
      try {
        await sessionManager.sendPresence(sessionId, chatId, state)
      } catch {
        /* best effort */
      }
    })

    socket.on('chat:read', async ({ sessionId, chatId }) => {
      try {
        await sessionManager.markChatRead(sessionId, chatId)
      } catch {
        /* best effort */
      }
    })

    // Clients join a room per open chat. The session manager checks the room
    // occupancy before incrementing unread counters / sending read receipts.
    socket.on('chat:open', ({ chatId } = { chatId: '' }) => {
      if (chatId) void socket.join(`chat:${chatId}`)
    })

    socket.on('chat:close', ({ chatId } = { chatId: '' }) => {
      if (chatId) void socket.leave(`chat:${chatId}`)
    })
  })

  return io
}
