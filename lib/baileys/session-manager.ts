import fs from 'node:fs/promises'
import path from 'node:path'
import {
  Browsers,
  DisconnectReason,
  delay,
  fetchLatestBaileysVersion,
  isJidGroup,
  makeWASocket,
  type AnyMessageContent,
  type BaileysEventMap,
  type WAMessage,
  type WASocket,
  type proto,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import prisma from '@/lib/prisma'
import { baileysLogger, logger } from '@/lib/logger'
import {
  broadcast,
  emitToSession,
  getIO,
} from '@/lib/socket-server'
import type { ChatDTO, MessageDTO, SessionStatus } from '@/lib/types'
import { jidToNumber, normalizePhoneNumber, toJid } from '@/lib/utils'
import { createAuthState, hasStoredCreds, removeAuthState } from './auth-state'
import { storeIncomingMedia } from './media'
import { MEDIA_ROOT, ensureDir, guessExtension, sessionMediaDir } from './paths'
import {
  ensureChat,
  isIgnoredJid,
  parseWaMessage,
  previewFor,
  toChatDTO,
  toMessageDTO,
  toSessionDTO,
  waStatusToDb,
  type ParsedMessage,
} from './persistence'
import { toOggOpus } from './transcode'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface LiveSession {
  sessionId: string
  sock: WASocket
  qr: string | null
  reconnectAttempts: number
  reconnectTimer: NodeJS.Timeout | null
  manualDisconnect: boolean
  pairingRequested: boolean
  startedAt: number
  /** Set when a newer socket replaced this one — its events must be ignored. */
  stale?: boolean
}

export interface OutgoingPayload {
  kind: 'text' | 'image' | 'video' | 'audio' | 'document'
  text?: string | null
  buffer?: Buffer | null
  mimetype?: string | null
  fileName?: string | null
  ptt?: boolean
  caption?: string | null
  quotedMessageId?: string | null
}

const MAX_RECONNECT_ATTEMPTS = 12

/* ------------------------------------------------------------------ */
/* Session Manager                                                     */
/* ------------------------------------------------------------------ */

class SessionManager {
  private sessions = new Map<string, LiveSession>()

  /* ----------------------------- helpers ---------------------------- */

  isLive(sessionId: string) {
    return this.sessions.has(sessionId)
  }

  getLive(sessionId: string): LiveSession | null {
    return this.sessions.get(sessionId) ?? null
  }

  private requireLive(sessionId: string): LiveSession {
    const live = this.sessions.get(sessionId)
    if (!live) {
      throw new Error('Session is not running. Reconnect it from the dashboard first.')
    }
    return live
  }

  private async setStatus(
    sessionId: string,
    status: SessionStatus,
    extra: {
      pairingCode?: string | null
      pairingCodeExpiresAt?: Date | null
      pushName?: string | null
      lastError?: string | null
      connectedAt?: Date | null
    } = {},
  ) {
    const updated = await prisma.waSession.update({
      where: { id: sessionId },
      data: { status, ...extra },
    })

    emitToSession(sessionId, 'session:status', {
      sessionId,
      status,
      pushName: updated.pushName,
      phoneNumber: updated.phoneNumber,
      lastError: updated.lastError,
      connectedAt: updated.connectedAt?.toISOString() ?? null,
    })
    broadcast('sessions:changed')

    return updated
  }

  private clearReconnect(sessionId: string) {
    const live = this.sessions.get(sessionId)
    if (live?.reconnectTimer) {
      clearTimeout(live.reconnectTimer)
      live.reconnectTimer = null
    }
  }

  /* ------------------------------ boot ------------------------------ */

  /** Restores every session that was connected before the process restarted. */
  async boot() {
    if (process.env.WA_AUTO_RESTORE === 'false') {
      logger.info('WA_AUTO_RESTORE=false — skipping session restore')
      return
    }

    const sessions = await prisma.waSession.findMany({
      orderBy: { createdAt: 'asc' },
    })

    logger.info({ count: sessions.length }, 'restoring sessions')

    for (const session of sessions) {
      const hasCreds = await hasStoredCreds(session.id)
      if (!hasCreds) {
        if (session.status === 'connected' || session.status === 'connecting') {
          await prisma.waSession.update({
            where: { id: session.id },
            data: { status: 'disconnected', pairingCode: null },
          })
        }
        continue
      }

      // A stored (registered) session should always come back online.
      if (session.status === 'connected' || session.status === 'connecting') {
        try {
          await this.startSocket(session.id, { fresh: false })
        } catch (error) {
          logger.error({ error, sessionId: session.id }, 'failed to restore session')
          await this.setStatus(session.id, 'error', {
            lastError: error instanceof Error ? error.message : String(error),
          })
        }
      } else if (session.status === 'pairing') {
        await prisma.waSession.update({
          where: { id: session.id },
          data: { status: 'disconnected', pairingCode: null, pairingCodeExpiresAt: null },
        })
      }
    }
  }

  /* --------------------------- create/CRUD -------------------------- */

  async listSessions() {
    const sessions = await prisma.waSession.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { chats: true, messages: true } },
      },
    })

    const unread = await prisma.chat.groupBy({
      by: ['sessionId'],
      _sum: { unreadCount: true },
    })
    const unreadMap = new Map(unread.map((u) => [u.sessionId, u._sum.unreadCount ?? 0]))

    return sessions.map((session) => ({
      ...toSessionDTO(session, this.isLive(session.id)),
      stats: {
        chats: session._count.chats,
        messages: session._count.messages,
        unread: unreadMap.get(session.id) ?? 0,
      },
    }))
  }

  async createSession(input: { name?: string; phoneNumber: string }) {
    const phoneNumber = normalizePhoneNumber(input.phoneNumber)
    if (!phoneNumber || phoneNumber.length < 8) {
      throw new Error('Invalid phone number. Use the international format, e.g. 6281234567890')
    }

    const existing = await prisma.waSession.findUnique({ where: { phoneNumber } })
    if (existing) {
      throw new Error(`Session for +${phoneNumber} already exists`)
    }

    const session = await prisma.waSession.create({
      data: {
        name: input.name?.trim() || `+${phoneNumber}`,
        phoneNumber,
        status: 'disconnected',
      },
    })

    broadcast('sessions:changed')
    emitToSession(session.id, 'session:created', { sessionId: session.id })

    return toSessionDTO(session, false)
  }

  async getSession(sessionId: string) {
    const session = await prisma.waSession.findUnique({ where: { id: sessionId } })
    if (!session) return null
    return toSessionDTO(session, this.isLive(sessionId))
  }

  /** Full delete: unlink, wipe auth files, media and DB rows. */
  async deleteSession(sessionId: string) {
    await this.disconnect(sessionId).catch(() => undefined)
    await prisma.waSession.delete({ where: { id: sessionId } }).catch(() => undefined)
    await removeAuthState(sessionId).catch(() => undefined)
    await fs.rm(sessionMediaDir(sessionId), { recursive: true, force: true }).catch(() => undefined)

    emitToSession(sessionId, 'session:deleted', { sessionId })
    broadcast('sessions:changed')
  }

  /* ------------------------------ socket ---------------------------- */

  async startSocket(sessionId: string, options: { fresh?: boolean } = {}) {
    this.clearReconnect(sessionId)

    const record = await prisma.waSession.findUnique({ where: { id: sessionId } })
    if (!record) throw new Error('Session not found')

    // Never run two sockets for the same session.
    const previous = this.sessions.get(sessionId)
    if (previous) {
      previous.manualDisconnect = true
      previous.stale = true
      try {
        previous.sock.ev.removeAllListeners('connection.update')
        previous.sock.ws?.close()
        previous.sock.end(undefined)
      } catch {
        /* ignore */
      }
      this.sessions.delete(sessionId)
      await delay(400)
    }

    const { state, saveCreds } = await createAuthState(sessionId)
    const { version } = await fetchLatestBaileysVersion().catch(() => ({
      version: undefined as number[] | undefined,
      isLatest: false,
    }))

    const sock = makeWASocket({
      version: version as [number, number, number] | undefined,
      auth: { creds: state.creds, keys: state.keys },
      logger: baileysLogger.child({ session: sessionId.slice(-6) }) as never,
      printQRInTerminal: false,
      browser: Browsers.appropriate('Chrome'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      getMessage: async () => undefined,
    })

    const live: LiveSession = {
      sessionId,
      sock,
      qr: null,
      reconnectAttempts: 0,
      reconnectTimer: null,
      manualDisconnect: false,
      pairingRequested: false,
      startedAt: Date.now(),
    }
    this.sessions.set(sessionId, live)

    if (state.creds.registered) {
      await this.setStatus(sessionId, 'connecting', { lastError: null })
    }

    sock.ev.on('creds.update', () => {
      void saveCreds()
    })

    sock.ev.on('connection.update', (update) => {
      void this.handleConnectionUpdate(live, update).catch((error) => {
        logger.error({ error, sessionId }, 'connection.update handler failed')
      })
    })

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') return
      void (async () => {
        for (const message of messages) {
          await this.handleIncomingMessage(live, message).catch((error) => {
            logger.warn({ error, sessionId }, 'failed to persist incoming message')
          })
        }
      })()
    })

    sock.ev.on('messages.update', (updates) => {
      void (async () => {
        for (const update of updates) {
          const status = waStatusToDb(update.update?.status as number | undefined)
          if (!status || !update.key?.id) continue
          await this.applyMessageStatus(live.sessionId, update.key.id, status)
        }
      })()
    })

    sock.ev.on('message-receipt.update', (receipts) => {
      void (async () => {
        for (const receipt of receipts) {
          const id = receipt.key?.id
          if (!id) continue
          const isRead = Boolean(receipt.receipt?.readTimestamp)
          const isDelivered = Boolean(receipt.receipt?.receiptTimestamp)
          const status = isRead ? 'read' : isDelivered ? 'delivered' : null
          if (status) await this.applyMessageStatus(live.sessionId, id, status)
        }
      })()
    })

    sock.ev.on('contacts.upsert', (contacts) => {
      void (async () => {
        for (const contact of contacts) {
          const jid = contact.id
          if (!jid || isIgnoredJid(jid)) continue
          const name = contact.name || contact.notify || contact.verifiedName
          if (!name) continue
          const { chat } = await ensureChat(live.sessionId, jid, { name })
          emitToSession(live.sessionId, 'session:chat', {
            sessionId: live.sessionId,
            chat: toChatDTO(chat),
          })
        }
      })().catch(() => undefined)
    })

    sock.ev.on('groups.update', (groups) => {
      void (async () => {
        for (const group of groups) {
          if (!group.id || !group.subject) continue
          const { chat } = await ensureChat(live.sessionId, group.id, {
            name: group.subject,
            isGroup: true,
          })
          emitToSession(live.sessionId, 'session:chat', {
            sessionId: live.sessionId,
            chat: toChatDTO(chat),
          })
        }
      })().catch(() => undefined)
    })

    return sock
  }

  private async handleConnectionUpdate(
    live: LiveSession,
    update: BaileysEventMap['connection.update'],
  ) {
    const { connection, lastDisconnect, qr } = update
    const { sessionId, sock } = live

    // A newer socket already took over this session: never touch its status
    // from this stale instance (avoids "disconnected" overwriting "connecting").
    if (live.stale) return

    if (qr) {
      live.qr = qr
      emitToSession(sessionId, 'session:qr', { sessionId, qr })
      if (!sock.authState.creds.registered) {
        logger.warn({ sessionId }, 'WhatsApp asked for a QR code — use Pairing Code instead')
      }
    }

    if (connection === 'connecting') {
      if (!sock.authState.creds.registered) {
        await this.setStatus(sessionId, 'connecting', { lastError: null })
      }
      return
    }

    if (connection === 'open') {
      live.reconnectAttempts = 0
      live.qr = null
      const me = sock.user
      logger.info({ sessionId, user: me?.id }, 'session connected')

      const pushName = me?.name || me?.verifiedName || null
      const phoneNumber = me?.id ? normalizePhoneNumber(jidToNumber(me.id)) : undefined

      await prisma.waSession.update({
        where: { id: sessionId },
        data: {
          status: 'connected',
          pairingCode: null,
          pairingCodeExpiresAt: null,
          lastError: null,
          pushName,
          connectedAt: new Date(),
          ...(phoneNumber ? { phoneNumber } : {}),
        },
      })

      emitToSession(sessionId, 'session:status', {
        sessionId,
        status: 'connected',
        pushName,
        lastError: null,
        connectedAt: new Date().toISOString(),
      })
      broadcast('sessions:changed')
      return
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode
      const reason = statusCode ? (DisconnectReason as Record<number, string>)[statusCode] : 'unknown'
      logger.info({ sessionId, statusCode, reason, manual: live.manualDisconnect }, 'connection closed')

      // User pressed "Disconnect" / we are shutting down: do not reconnect.
      if (live.manualDisconnect) {
        this.sessions.delete(sessionId)
        if (sock.authState.creds.registered) {
          await this.setStatus(sessionId, 'disconnected')
        }
        return
      }

      if (statusCode === DisconnectReason.loggedOut) {
        this.sessions.delete(sessionId)
        await removeAuthState(sessionId)
        await this.setStatus(sessionId, 'disconnected', {
          pairingCode: null,
          pairingCodeExpiresAt: null,
          lastError: 'Logged out from WhatsApp (device unlinked)',
          connectedAt: null,
        })
        emitToSession(sessionId, 'session:qr', { sessionId, qr: null })
        return
      }

      // 515 = restart required: WhatsApp expects an immediate reconnect after
      // the pairing code was accepted, this is the normal end of the flow.
      if (statusCode === DisconnectReason.restartRequired) {
        this.sessions.delete(sessionId)
        await delay(800)
        await this.startSocket(sessionId, { fresh: false })
        return
      }

      if (
        statusCode === DisconnectReason.connectionReplaced ||
        statusCode === DisconnectReason.multideviceMismatch
      ) {
        this.sessions.delete(sessionId)
        await this.setStatus(sessionId, 'disconnected', {
          lastError:
            statusCode === DisconnectReason.connectionReplaced
              ? 'Session replaced by another WhatsApp Web/Desktop client'
              : 'Multi-device mismatch — please pair again',
        })
        return
      }

      // Everything else (timeouts, network drops, 428, 500, 503): auto reconnect
      this.sessions.delete(sessionId)
      live.reconnectAttempts += 1

      if (live.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
        await this.setStatus(sessionId, 'error', {
          lastError: `Giving up after ${MAX_RECONNECT_ATTEMPTS} reconnect attempts (last: ${reason})`,
        })
        return
      }

      const backoff = Math.min(2000 * live.reconnectAttempts, 30000)
      await this.setStatus(sessionId, 'connecting', {
        lastError: `Reconnecting in ${Math.round(backoff / 1000)}s (${reason})`,
      })

      const timer = setTimeout(() => {
        void this.startSocket(sessionId, { fresh: false })
          .then(() => {
            const next = this.sessions.get(sessionId)
            if (next) next.reconnectAttempts = live.reconnectAttempts
          })
          .catch((error) => {
            logger.error({ error, sessionId }, 'reconnect failed')
          })
      }, backoff)

      live.reconnectTimer = timer
      this.sessions.set(sessionId, live)
    }
  }

  /* ---------------------------- pairing ----------------------------- */

  /** Creates the socket (if needed) and returns a fresh 6-digit pairing code. */
  async requestPairingCode(sessionId: string, phoneNumberOverride?: string) {
    const record = await prisma.waSession.findUnique({ where: { id: sessionId } })
    if (!record) throw new Error('Session not found')

    const phoneNumber = normalizePhoneNumber(phoneNumberOverride || record.phoneNumber)
    if (!phoneNumber || phoneNumber.length < 8) {
      throw new Error('Invalid phone number. Use the international format, e.g. 6281234567890')
    }
    if (phoneNumber !== record.phoneNumber) {
      await prisma.waSession.update({
        where: { id: sessionId },
        data: { phoneNumber, name: record.name === `+${record.phoneNumber}` ? `+${phoneNumber}` : record.name },
      })
    }

    let live = this.sessions.get(sessionId)
    if (!live) {
      await this.startSocket(sessionId, { fresh: true })
      live = this.sessions.get(sessionId) as LiveSession
    }

    const { sock } = live
    if (sock.authState.creds.registered) {
      throw new Error('This session is already registered. Logout first to pair a new device.')
    }
    if (live.pairingRequested) {
      logger.info({ sessionId }, 'pairing code re-requested — reusing existing socket')
    }

    await this.setStatus(sessionId, 'pairing', { lastError: null })

    // Wait until the underlying websocket is actually open before asking for
    // the code, otherwise WhatsApp rejects the request.
    await this.waitForSocketOpen(sock, 15000)

    let lastError: unknown = null
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const code = await sock.requestPairingCode(phoneNumber)
        live.pairingRequested = true

        const formatted = code?.match(/.{1,4}/g)?.join('-') ?? code
        const expiresAt = new Date(Date.now() + 3 * 60 * 1000)

        await prisma.waSession.update({
          where: { id: sessionId },
          data: { pairingCode: formatted, pairingCodeExpiresAt: expiresAt, status: 'pairing' },
        })

        emitToSession(sessionId, 'session:pairing-code', {
          sessionId,
          code: formatted,
          expiresAt: expiresAt.toISOString(),
        })
        broadcast('sessions:changed')

        logger.info({ sessionId, code: formatted }, 'pairing code issued')
        return { code: formatted, expiresAt: expiresAt.toISOString() }
      } catch (error) {
        lastError = error
        logger.warn({ error, attempt, sessionId }, 'requestPairingCode failed')
        await delay(1500 * attempt)
      }
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError)
    await this.setStatus(sessionId, 'error', { lastError: message })
    throw new Error(`Failed to get pairing code: ${message}`)
  }

  private async waitForSocketOpen(sock: WASocket, timeoutMs: number) {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      const state = (sock.ws as unknown as { readyState?: number })?.readyState
      if (state === 1) return true
      await delay(300)
    }
    return false
  }

  /* --------------------------- disconnect --------------------------- */

  /** Closes the socket but keeps the credentials (session can reconnect). */
  async disconnect(sessionId: string) {
    this.clearReconnect(sessionId)
    const live = this.sessions.get(sessionId)
    if (live) {
      live.manualDisconnect = true
      try {
        live.sock.ws?.close()
        live.sock.end(undefined)
      } catch {
        /* ignore */
      }
      this.sessions.delete(sessionId)
    }

    const record = await prisma.waSession.findUnique({ where: { id: sessionId } })
    if (record) {
      await this.setStatus(sessionId, 'disconnected', {
        pairingCode: null,
        pairingCodeExpiresAt: null,
        connectedAt: null,
      })
    }
  }

  /** Unlinks the device on WhatsApp's side and wipes local auth files. */
  async logout(sessionId: string) {
    this.clearReconnect(sessionId)
    const live = this.sessions.get(sessionId)

    if (live) {
      live.manualDisconnect = true
      try {
        await live.sock.logout()
      } catch (error) {
        logger.warn({ error, sessionId }, 'logout() call failed — wiping local auth anyway')
      }
      try {
        live.sock.end(undefined)
      } catch {
        /* ignore */
      }
      this.sessions.delete(sessionId)
    }

    await removeAuthState(sessionId)
    await this.setStatus(sessionId, 'disconnected', {
      pairingCode: null,
      pairingCodeExpiresAt: null,
      connectedAt: null,
      pushName: null,
      lastError: null,
    })
  }

  /* ----------------------------- chats ------------------------------ */

  async listChats(sessionId: string, options: { search?: string; archived?: boolean } = {}) {
    const chats = await prisma.chat.findMany({
      where: {
        sessionId,
        archived: options.archived ?? false,
        ...(options.search
          ? {
              OR: [
                { name: { contains: options.search } },
                { jid: { contains: options.search } },
                { lastMessagePreview: { contains: options.search } },
              ],
            }
          : {}),
      },
      orderBy: [{ pinned: 'desc' }, { lastMessageAt: 'desc' }],
      take: 200,
    })

    return chats.map(toChatDTO)
  }

  async getChat(chatId: string) {
    const chat = await prisma.chat.findUnique({ where: { id: chatId } })
    return chat ? toChatDTO(chat) : null
  }

  /** Opens (or creates) a 1:1 conversation for a phone number. */
  async openChatByNumber(sessionId: string, rawPhoneNumber: string) {
    const phoneNumber = normalizePhoneNumber(rawPhoneNumber)
    if (!phoneNumber) throw new Error('Invalid phone number')

    const live = this.sessions.get(sessionId)
    const jid = toJid(phoneNumber)

    if (live?.sock && live.sock.user) {
      const result = await live.sock.onWhatsApp(jid).catch(() => null)
      const found = result?.find((entry) => entry.exists)
      if (!found) {
        throw new Error(`+${phoneNumber} is not registered on WhatsApp`)
      }
    }

    const { chat } = await ensureChat(sessionId, jid, { name: `+${phoneNumber}` })
    emitToSession(sessionId, 'session:chat', {
      sessionId,
      chat: toChatDTO(chat),
    })
    return toChatDTO(chat)
  }

  async updateChat(chatId: string, data: { pinned?: boolean; archived?: boolean; read?: boolean }) {
    const chat = await prisma.chat.update({
      where: { id: chatId },
      data: {
        ...(data.pinned !== undefined ? { pinned: data.pinned } : {}),
        ...(data.archived !== undefined ? { archived: data.archived } : {}),
        ...(data.read ? { unreadCount: 0 } : {}),
      },
    })
    return toChatDTO(chat)
  }

  async listMessages(sessionId: string, chatId: string, options: { limit?: number; before?: string } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200)
    const messages = await prisma.message.findMany({
      where: {
        sessionId,
        chatId,
        ...(options.before ? { timestamp: { lt: new Date(options.before) } } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    })

    return messages.reverse().map(toMessageDTO)
  }

  async markChatRead(sessionId: string, chatId: string) {
    const live = this.sessions.get(sessionId)
    const chat = await prisma.chat.findUnique({ where: { id: chatId } })
    if (!chat) return

    if (live?.sock) {
      const unread = await prisma.message.findMany({
        where: { chatId, fromMe: false, status: { not: 'read' } },
        orderBy: { timestamp: 'desc' },
        take: 100,
      })

      const keys = unread
        .filter((message) => message.waMessageId)
        .map((message) => ({
          remoteJid: chat.jid,
          id: message.waMessageId as string,
          fromMe: false,
          participant: chat.isGroup ? (message.senderJid ?? undefined) : undefined,
        }))

      if (keys.length > 0) {
        try {
          await live.sock.readMessages(keys)
        } catch (error) {
          logger.warn({ error }, 'readMessages failed')
        }
        await prisma.message.updateMany({
          where: { id: { in: unread.map((m) => m.id) } },
          data: { status: 'read' },
        })
      }
    }

    const updated = await prisma.chat.update({
      where: { id: chatId },
      data: { unreadCount: 0 },
    })
    emitToSession(sessionId, 'session:chat', {
      sessionId,
      chat: toChatDTO(updated),
    })
  }

  async sendPresence(sessionId: string, chatId: string, state: 'composing' | 'paused') {
    const live = this.sessions.get(sessionId)
    if (!live) return
    const chat = await prisma.chat.findUnique({ where: { id: chatId } })
    if (!chat) return
    await live.sock.sendPresenceUpdate(state, chat.jid).catch(() => undefined)
  }

  /* ---------------------------- messages ---------------------------- */

  /**
   * Persists an incoming (or self-sent from another device) message and pushes
   * it to every dashboard listening on the session room.
   */
  private async handleIncomingMessage(live: LiveSession, raw: WAMessage) {
    const { sessionId, sock } = live
    const jid = raw.key?.remoteJid
    if (!jid || isIgnoredJid(jid)) return
    if (!raw.message) return

    const parsed = parseWaMessage(raw)
    if (!parsed) return

    const existing = await prisma.message.findFirst({
      where: { sessionId, waMessageId: parsed.waMessageId },
      select: { id: true },
    })
    if (existing) return

    await this.persistMessage(sessionId, jid, parsed, raw, sock)
  }

  private async persistMessage(
    sessionId: string,
    jid: string,
    parsed: ParsedMessage,
    raw: WAMessage,
    sock: WASocket,
  ): Promise<{ message: MessageDTO; chat: ChatDTO }> {
    const isGroup = isJidGroup(jid) ?? false
    // For 1:1 chats WhatsApp does not send a contact name with every message —
    // pushName is the best label we get when no group metadata exists.
    let chatName: string | null = parsed.fromMe ? null : parsed.senderName

    if (isGroup) {
      const { chat } = await ensureChat(sessionId, jid, { isGroup: true })
      if (!chat.name) {
        try {
          const metadata = await sock.groupMetadata(jid)
          chatName = metadata.subject ?? null
        } catch {
          chatName = null
        }
      } else {
        chatName = chat.name
      }
    } else if (parsed.fromMe) {
      chatName = null
    }

    const { chat } = await ensureChat(sessionId, jid, {
      name: chatName ?? undefined,
      isGroup,
    })

    // Media (photos, videos, voice notes, documents, stickers) -> disk
    let mediaPath: string | null = null
    let mediaSize = parsed.mediaSize
    if (parsed.needsDownload) {
      const stored = await storeIncomingMedia(
        sessionId,
        sock,
        raw as unknown as proto.IWebMessageInfo,
        parsed.mediaMime,
        parsed.mediaName,
      )
      mediaPath = stored.mediaPath
      mediaSize = stored.mediaSize ?? mediaSize
    }

    const clientHasChatOpen = this.isChatOpen(chat.id)
    const shouldCountUnread = !parsed.fromMe && !clientHasChatOpen

    const message = await prisma.message.create({
      data: {
        sessionId,
        chatId: chat.id,
        waMessageId: parsed.waMessageId,
        fromMe: parsed.fromMe,
        senderJid: parsed.senderJid,
        senderName: parsed.senderName,
        type: parsed.type,
        text: parsed.text,
        mediaPath,
        mediaMime: parsed.mediaMime,
        mediaName: parsed.mediaName,
        mediaSize,
        mediaDuration: parsed.mediaDuration,
        status: clientHasChatOpen && !parsed.fromMe ? 'read' : parsed.fromMe ? 'sent' : 'delivered',
        timestamp: parsed.timestamp,
      },
    })

    const updatedChat = await prisma.chat.update({
      where: { id: chat.id },
      data: {
        lastMessagePreview: previewFor(parsed.type, parsed.text),
        lastMessageAt: parsed.timestamp,
        unreadCount: shouldCountUnread ? { increment: 1 } : clientHasChatOpen ? 0 : undefined,
        archived: false,
      },
    })

    const messageDTO = toMessageDTO(message)
    const chatDTO = toChatDTO(updatedChat)

    emitToSession(sessionId, 'session:message', { sessionId, message: messageDTO, chat: chatDTO })
    broadcast('sessions:changed')

    // The chat is open in a browser tab: acknowledge the message immediately.
    if (clientHasChatOpen && !parsed.fromMe) {
      void this.markChatRead(sessionId, chat.id).catch(() => undefined)
    }

    return { message: messageDTO, chat: chatDTO }
  }

  private isChatOpen(chatId: string) {
    const room = getIO()?.sockets.adapter.rooms.get(`chat:${chatId}`)
    return (room?.size ?? 0) > 0
  }

  async sendMessage(sessionId: string, chatId: string, payload: OutgoingPayload) {
    const live = this.requireLive(sessionId)
    const chat = await prisma.chat.findUnique({ where: { id: chatId } })
    if (!chat) throw new Error('Chat not found')

    const { sock } = live
    const content: AnyMessageContent =
      payload.kind === 'text'
        ? { text: (payload.text ?? '').toString() }
        : payload.kind === 'image'
          ? { image: payload.buffer as Buffer, caption: payload.caption ?? undefined, mimetype: payload.mimetype ?? undefined }
          : payload.kind === 'video'
            ? { video: payload.buffer as Buffer, caption: payload.caption ?? undefined, mimetype: payload.mimetype ?? undefined }
            : payload.kind === 'audio'
              ? payload.ptt
                ? { audio: payload.buffer as Buffer, ptt: true, mimetype: payload.mimetype ?? 'audio/ogg; codecs=opus' }
                : { audio: payload.buffer as Buffer, ptt: false, mimetype: payload.mimetype ?? 'audio/mp4' }
              : {
                  document: payload.buffer as Buffer,
                  mimetype: payload.mimetype ?? 'application/octet-stream',
                  fileName: payload.fileName ?? 'file',
                  caption: payload.caption ?? undefined,
                }

    if (payload.kind === 'text' && !payload.text?.trim()) {
      throw new Error('Message text cannot be empty')
    }

    const sent = await sock.sendMessage(chat.jid, content, {})
    if (!sent) throw new Error('Baileys failed to send the message')

    // Store our own media so it can be previewed later (WhatsApp will not let us
    // download our own uploads again).
    let mediaPath: string | null = null
    if (payload.kind !== 'text' && payload.buffer) {
      try {
        const dir = await ensureDir(sessionMediaDir(sessionId))
        const ext = guessExtension(payload.mimetype, payload.fileName)
        const absolute = path.join(dir, `out-${sent.key.id}.${ext}`)
        await fs.writeFile(absolute, payload.buffer)
        mediaPath = path.relative(MEDIA_ROOT, absolute)
      } catch (error) {
        logger.warn({ error }, 'failed to store outgoing media copy')
      }
    }

    const text =
      payload.kind === 'text'
        ? (payload.text ?? '').trim()
        : (payload.caption ?? null)

    const message = await prisma.message.create({
      data: {
        sessionId,
        chatId: chat.id,
        waMessageId: sent.key.id ?? null,
        fromMe: true,
        senderJid: sock.user?.id ?? null,
        senderName: sock.user?.name ?? null,
        type: payload.kind,
        text,
        mediaPath,
        mediaMime: payload.kind === 'text' ? null : (payload.mimetype ?? null),
        mediaName: payload.fileName ?? null,
        mediaSize: payload.buffer?.length ?? null,
        status: 'sent',
        timestamp: new Date(),
      },
    })

    const updatedChat = await prisma.chat.update({
      where: { id: chat.id },
      data: {
        lastMessagePreview: previewFor(payload.kind, text),
        lastMessageAt: message.timestamp,
      },
    })

    const messageDTO = toMessageDTO(message)
    const chatDTO = toChatDTO(updatedChat)

    emitToSession(sessionId, 'session:message', { sessionId, message: messageDTO, chat: chatDTO })

    return { message: messageDTO, chat: chatDTO }
  }

  /** Transcodes a browser recording (webm/opus) into a WhatsApp voice note. */
  async prepareVoiceNote(buffer: Buffer, mimetype: string | null) {
    const isOgg = (mimetype ?? '').includes('ogg') || (mimetype ?? '').includes('opus')
    if (isOgg) {
      return { buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true }
    }

    const converted = await toOggOpus(buffer)
    if (converted) {
      return { buffer: converted, mimetype: 'audio/ogg; codecs=opus', ptt: true }
    }

    // ffmpeg missing: send as a normal audio attachment so the file still
    // arrives instead of silently failing.
    return { buffer, mimetype: mimetype ?? 'audio/webm', ptt: false }
  }

  private async applyMessageStatus(sessionId: string, waMessageId: string, status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed') {
    const message = await prisma.message.findFirst({
      where: { sessionId, waMessageId },
      select: { id: true, chatId: true, status: true },
    })
    if (!message || message.status === status) return
    if (message.status === 'read' && status !== 'read') return

    await prisma.message.update({
      where: { id: message.id },
      data: { status },
    })

    emitToSession(sessionId, 'session:message-status', {
      sessionId,
      chatId: message.chatId,
      waMessageId,
      status,
    })
  }

  /* ---------------------------- utilities --------------------------- */

  async profilePicture(sessionId: string, jid: string) {
    const live = this.sessions.get(sessionId)
    if (!live) return null
    try {
      return await live.sock.profilePictureUrl(jid, 'image')
    } catch {
      return null
    }
  }

  async changeProfilePicture(sessionId: string, jid: string) {
    return this.profilePicture(sessionId, jid)
  }

  async checkNumber(sessionId: string, rawPhoneNumber: string) {
    const live = this.requireLive(sessionId)
    const phoneNumber = normalizePhoneNumber(rawPhoneNumber)
    const jid = toJid(phoneNumber)
    const [result] = (await live.sock.onWhatsApp(jid)) ?? []
    return {
      phoneNumber,
      jid,
      exists: Boolean(result?.exists),
    }
  }

  async stats() {
    const [sessions, connected, chats, messages, media] = await Promise.all([
      prisma.waSession.count(),
      prisma.waSession.count({ where: { status: 'connected' } }),
      prisma.chat.count(),
      prisma.message.count(),
      prisma.message.count({ where: { NOT: { mediaPath: null } } }),
    ])
    return { sessions, connected, chats, messages, media }
  }

  /** Graceful shutdown: close every socket without touching the auth files. */
  async shutdown() {
    logger.info({ count: this.sessions.size }, 'closing live sessions')
    for (const live of this.sessions.values()) {
      live.manualDisconnect = true
      this.clearReconnect(live.sessionId)
      try {
        live.sock.ws?.close()
        live.sock.end(undefined)
      } catch {
        /* ignore */
      }
    }
    this.sessions.clear()
  }
}

/* ------------------------------------------------------------------ */
/* Singleton (shared between server.ts and the Next.js route handlers)  */
/* ------------------------------------------------------------------ */

const globalStore = globalThis as unknown as { __waSessionManager?: SessionManager }

export const sessionManager: SessionManager = globalStore.__waSessionManager ?? new SessionManager()
globalStore.__waSessionManager = sessionManager

export { SessionManager }
