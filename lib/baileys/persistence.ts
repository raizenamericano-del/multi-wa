import { getContentType, type proto } from '@whiskeysockets/baileys'
import prisma from '@/lib/prisma'
import type {
  ChatDTO,
  MessageDTO,
  MessageStatus,
  MessageType,
  SessionDTO,
} from '@/lib/types'
import { isGroupJid } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* DTO mappers                                                         */
/* ------------------------------------------------------------------ */

type SessionRecord = {
  id: string
  name: string
  phoneNumber: string
  status: string
  pairingCode: string | null
  pairingCodeExpiresAt: Date | null
  pushName: string | null
  lastError: string | null
  connectedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export function toSessionDTO(
  session: SessionRecord,
  isLive = false,
): SessionDTO {
  return {
    id: session.id,
    name: session.name,
    phoneNumber: session.phoneNumber,
    status: session.status as SessionDTO['status'],
    pairingCode: session.pairingCode,
    pairingCodeExpiresAt: session.pairingCodeExpiresAt?.toISOString() ?? null,
    pushName: session.pushName,
    lastError: session.lastError,
    connectedAt: session.connectedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    isLive,
  }
}

type ChatRecord = {
  id: string
  sessionId: string
  jid: string
  name: string | null
  isGroup: boolean
  unreadCount: number
  lastMessagePreview: string | null
  lastMessageAt: Date
  pinned: boolean
  archived: boolean
}

export function toChatDTO(chat: ChatRecord): ChatDTO {
  return {
    id: chat.id,
    sessionId: chat.sessionId,
    jid: chat.jid,
    name: chat.name,
    isGroup: chat.isGroup,
    unreadCount: chat.unreadCount,
    lastMessagePreview: chat.lastMessagePreview,
    lastMessageAt: chat.lastMessageAt.toISOString(),
    pinned: chat.pinned,
    archived: chat.archived,
  }
}

type MessageRecord = {
  id: string
  sessionId: string
  chatId: string
  waMessageId: string | null
  fromMe: boolean
  senderJid: string | null
  senderName: string | null
  type: string
  text: string | null
  mediaPath: string | null
  mediaMime: string | null
  mediaName: string | null
  mediaSize: number | null
  mediaDuration: number | null
  status: string
  timestamp: Date
  createdAt: Date
}

export function toMessageDTO(message: MessageRecord): MessageDTO {
  return {
    id: message.id,
    sessionId: message.sessionId,
    chatId: message.chatId,
    waMessageId: message.waMessageId,
    fromMe: message.fromMe,
    senderJid: message.senderJid,
    senderName: message.senderName,
    type: message.type as MessageType,
    text: message.text,
    mediaPath: message.mediaPath,
    mediaMime: message.mediaMime,
    mediaName: message.mediaName,
    mediaSize: message.mediaSize,
    mediaDuration: message.mediaDuration,
    status: message.status as MessageStatus,
    timestamp: message.timestamp.toISOString(),
    createdAt: message.createdAt.toISOString(),
  }
}

/* ------------------------------------------------------------------ */
/* Chats                                                               */
/* ------------------------------------------------------------------ */

export async function ensureChat(
  sessionId: string,
  jid: string,
  options: { name?: string | null; isGroup?: boolean } = {},
) {
  const isGroup = options.isGroup ?? isGroupJid(jid)
  const existing = await prisma.chat.findUnique({
    where: { sessionId_jid: { sessionId, jid } },
  })

  if (existing) {
    if (options.name && options.name !== existing.name) {
      const updated = await prisma.chat.update({
        where: { id: existing.id },
        data: { name: options.name },
      })
      return { chat: updated, created: false }
    }
    return { chat: existing, created: false }
  }

  const chat = await prisma.chat.create({
    data: {
      sessionId,
      jid,
      name: options.name ?? (isGroup ? null : jid.split('@')[0]),
      isGroup,
    },
  })

  return { chat, created: true }
}

/** Preview text shown in the chat list (WhatsApp-style summary). */
export function previewFor(type: MessageType, text: string | null | undefined) {
  const prefix: Partial<Record<MessageType, string>> = {
    image: '📷 Photo',
    video: '🎥 Video',
    audio: '🎙️ Voice note',
    document: '📄 Document',
    sticker: '🩹 Sticker',
  }
  if (type === 'text') return text ?? ''
  if (text) return `${prefix[type] ?? ''} · ${text}`.trim()
  return prefix[type] ?? '📎 Attachment'
}

/* ------------------------------------------------------------------ */
/* Message parsing (Baileys -> our model)                              */
/* ------------------------------------------------------------------ */

export interface ParsedMessage {
  waMessageId: string
  fromMe: boolean
  senderJid: string | null
  senderName: string | null
  type: MessageType
  text: string | null
  mediaMime: string | null
  mediaName: string | null
  mediaSize: number | null
  mediaDuration: number | null
  needsDownload: boolean
  timestamp: Date
}

/** Unwraps ephemeral / view-once / device-sent / caption wrappers. */
export function unwrapMessage(
  message: proto.IMessage | null | undefined,
): { content: proto.IMessage | null; viewOnce: boolean } {
  let current = message ?? null
  let viewOnce = false
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message
      continue
    }
    if (current.viewOnceMessage?.message) {
      viewOnce = true
      current = current.viewOnceMessage.message
      continue
    }
    if (current.viewOnceMessageV2?.message) {
      viewOnce = true
      current = current.viewOnceMessageV2.message
      continue
    }
    if (current.viewOnceMessageV2Extension?.message) {
      viewOnce = true
      current = current.viewOnceMessageV2Extension.message
      continue
    }
    if (current.documentWithCaptionMessage?.message) {
      current = current.documentWithCaptionMessage.message
      continue
    }
    if (current.deviceSentMessage?.message) {
      current = current.deviceSentMessage.message
      continue
    }
    break
  }
  return { content: current, viewOnce }
}

export function isIgnoredJid(jid?: string | null) {
  if (!jid) return true
  return (
    jid === 'status@broadcast' ||
    jid.endsWith('@broadcast') ||
    jid.endsWith('@newsletter') ||
    jid.endsWith('@lid')
  )
}

function secondsToNumber(value: number | Long | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const num = typeof value === 'number' ? value : Number(value.toString())
  return Number.isFinite(num) ? Math.round(num) : null
}

type Long = { toString(): string }

/** Turns a raw Baileys message into our own serialisable model. */
export function parseWaMessage(raw: proto.IWebMessageInfo): ParsedMessage | null {
  const key = raw.key
  if (!key?.remoteJid || !key.id) return null
  if (isIgnoredJid(key.remoteJid)) return null

  const fromMe = Boolean(key.fromMe)
  const { content } = unwrapMessage(raw.message)

  const base: Omit<ParsedMessage, 'type' | 'text' | 'needsDownload'> = {
    waMessageId: key.id,
    fromMe,
    senderJid: key.participant ?? key.remoteJid,
    senderName: raw.pushName ?? null,
    mediaMime: null,
    mediaName: null,
    mediaSize: null,
    mediaDuration: null,
    timestamp: new Date(Number(raw.messageTimestamp ?? Date.now() / 1000) * 1000),
  }

  if (!content) return null

  const contentType = getContentType(content)
  if (!contentType) return null

  const withMeta = (parsed: {
    type: ParsedMessage['type']
    text?: string | null
    mediaMime?: string | null
    mediaName?: string | null
    mediaSize?: number | null
    mediaDuration?: number | null
    needsDownload?: boolean
  }): ParsedMessage => ({
    ...base,
    type: parsed.type,
    text: parsed.text ?? null,
    mediaMime: parsed.mediaMime ?? null,
    mediaName: parsed.mediaName ?? null,
    mediaSize: parsed.mediaSize ?? null,
    mediaDuration: parsed.mediaDuration ?? null,
    needsDownload: parsed.needsDownload ?? false,
  })

  switch (contentType) {
    case 'conversation':
      return withMeta({ type: 'text', text: content.conversation ?? '', needsDownload: false })

    case 'extendedTextMessage':
      return withMeta({
        type: 'text',
        text: content.extendedTextMessage?.text ?? '',
        needsDownload: false,
      })

    case 'imageMessage':
      return withMeta({
        type: 'image',
        text: content.imageMessage?.caption ?? null,
        mediaMime: content.imageMessage?.mimetype ?? 'image/jpeg',
        mediaSize: content.imageMessage?.fileLength ? Number(content.imageMessage.fileLength.toString()) : null,
        needsDownload: true,
      })

    case 'videoMessage':
      return withMeta({
        type: 'video',
        text: content.videoMessage?.caption ?? null,
        mediaMime: content.videoMessage?.mimetype ?? 'video/mp4',
        mediaSize: content.videoMessage?.fileLength ? Number(content.videoMessage.fileLength.toString()) : null,
        mediaDuration: secondsToNumber(content.videoMessage?.seconds),
        needsDownload: true,
      })

    case 'audioMessage':
      return withMeta({
        type: 'audio',
        text: null,
        mediaMime: content.audioMessage?.mimetype ?? 'audio/ogg',
        mediaSize: content.audioMessage?.fileLength ? Number(content.audioMessage.fileLength.toString()) : null,
        mediaDuration: secondsToNumber(content.audioMessage?.seconds),
        needsDownload: true,
      })

    case 'documentMessage':
      return withMeta({
        type: 'document',
        text: content.documentMessage?.caption ?? null,
        mediaMime: content.documentMessage?.mimetype ?? 'application/octet-stream',
        mediaName: content.documentMessage?.fileName ?? null,
        mediaSize: content.documentMessage?.fileLength ? Number(content.documentMessage.fileLength.toString()) : null,
        needsDownload: true,
      })

    case 'stickerMessage':
      return withMeta({
        type: 'sticker',
        text: null,
        mediaMime: content.stickerMessage?.mimetype ?? 'image/webp',
        needsDownload: true,
      })

    case 'locationMessage': {
      const loc = content.locationMessage
      return withMeta({
        type: 'other',
        text: `📍 ${loc?.name || loc?.address || 'Location'}${loc?.degreesLatitude ? ` (${loc.degreesLatitude.toFixed(4)}, ${loc.degreesLongitude?.toFixed(4)})` : ''}`,
        needsDownload: false,
      })
    }

    case 'contactMessage':
      return withMeta({
        type: 'other',
        text: `👤 Contact: ${content.contactMessage?.displayName ?? 'unknown'}`,
        needsDownload: false,
      })

    case 'buttonsResponseMessage':
      return withMeta({
        type: 'text',
        text: content.buttonsResponseMessage?.selectedDisplayText ?? '[button reply]',
        needsDownload: false,
      })

    case 'listResponseMessage':
      return withMeta({
        type: 'text',
        text: content.listResponseMessage?.title ?? '[list reply]',
        needsDownload: false,
      })

    case 'templateButtonReplyMessage':
      return withMeta({
        type: 'text',
        text: content.templateButtonReplyMessage?.selectedDisplayText ?? '[template reply]',
        needsDownload: false,
      })

    case 'protocolMessage':
    case 'reactionMessage':
    case 'senderKeyDistributionMessage':
    case 'messageContextInfo':
      return null

    default:
      return withMeta({ type: 'other', text: `[${contentType}]`, needsDownload: false })
  }
}

export function waStatusToDb(status?: number | string | null): MessageStatus | null {
  const value = typeof status === 'string' ? Number(status) : status
  switch (value) {
    case 1:
      return 'pending'
    case 2:
      return 'sent'
    case 3:
      return 'delivered'
    case 4:
    case 5:
      return 'read'
    default:
      return null
  }
}
