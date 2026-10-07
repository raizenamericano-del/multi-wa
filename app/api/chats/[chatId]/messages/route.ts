import { z } from 'zod'
import { fail, handle, ok } from '@/lib/api'
import { sessionManager } from '@/lib/baileys/session-manager'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const MAX_UPLOAD_MB = Number(process.env.WA_MAX_UPLOAD_MB ?? 64)

/** GET /api/chats/:chatId/messages?limit=50&before=<ISO> */
export async function GET(request: Request, { params }: { params: { chatId: string } }) {
  return handle(async () => {
    const chat = await sessionManager.getChat(params.chatId)
    if (!chat) return fail('Chat not found', 404)

    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? 50)
    const before = url.searchParams.get('before') ?? undefined

    const messages = await sessionManager.listMessages(chat.sessionId, chat.id, { limit, before })
    return ok({ messages, chat })
  })
}

const jsonSchema = z.object({
  text: z.string().trim().min(1, 'Message cannot be empty').max(60000),
})

function kindFromMime(mime: string, requested?: string | null) {
  if (requested && ['image', 'video', 'audio', 'document'].includes(requested)) {
    return requested as 'image' | 'video' | 'audio' | 'document'
  }
  if (mime.startsWith('image/')) return 'image' as const
  if (mime.startsWith('video/')) return 'video' as const
  if (mime.startsWith('audio/')) return 'audio' as const
  return 'document' as const
}

/**
 * POST /api/chats/:chatId/messages
 *
 * Accepts either:
 *   - JSON  { "text": "hello" }                       (plain text message)
 *   - multipart/form-data with fields:
 *       file      (required)  the media
 *       kind      image | video | audio | document    (optional, inferred from mimetype)
 *       caption   string                              (optional)
 *       ptt       "true"                              (optional, voice note)
 */
export async function POST(request: Request, { params }: { params: { chatId: string } }) {
  return handle(async () => {
    const chat = await sessionManager.getChat(params.chatId)
    if (!chat) return fail('Chat not found', 404)

    const contentType = request.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file')
      if (!(file instanceof File)) {
        return fail('No file uploaded (field name must be "file")', 422)
      }
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        return fail(`File too large. Maximum ${MAX_UPLOAD_MB} MB.`, 413)
      }

      const mime = file.type || 'application/octet-stream'
      const requestedKind = form.get('kind')?.toString() ?? null
      const kind = kindFromMime(mime, requestedKind)
      const caption = form.get('caption')?.toString() ?? null
      const ptt = form.get('ptt')?.toString() === 'true'

      let buffer: Buffer = Buffer.from(await file.arrayBuffer())
      let mimetype = mime

      if (kind === 'audio' && ptt) {
        const prepared = await sessionManager.prepareVoiceNote(buffer, mime)
        buffer = prepared.buffer
        mimetype = prepared.mimetype
        const result = await sessionManager.sendMessage(chat.sessionId, chat.id, {
          kind: 'audio',
          buffer,
          mimetype,
          ptt: prepared.ptt,
          fileName: file.name || 'voice-note.ogg',
        })
        return ok({ message: result.message, chat: result.chat }, { status: 201 })
      }

      const result = await sessionManager.sendMessage(chat.sessionId, chat.id, {
        kind,
        buffer,
        mimetype,
        caption,
        fileName: file.name || undefined,
        ptt: false,
      })

      logger.info({ chatId: chat.id, kind, size: file.size }, 'media message sent')
      return ok({ message: result.message, chat: result.chat }, { status: 201 })
    }

    const body = jsonSchema.parse(await request.json())
    const result = await sessionManager.sendMessage(chat.sessionId, chat.id, {
      kind: 'text',
      text: body.text,
    })

    return ok({ message: result.message, chat: result.chat }, { status: 201 })
  })
}
