import fs from 'node:fs/promises'
import path from 'node:path'
import {
  downloadMediaMessage,
  type proto,
  type WASocket,
} from '@whiskeysockets/baileys'
import { baileysLogger, logger } from '@/lib/logger'
import { MEDIA_ROOT, ensureDir, guessExtension, sanitizeSegment, sessionMediaDir } from './paths'

const MAX_MEDIA_BYTES = Number(process.env.WA_MAX_MEDIA_MB ?? 64) * 1024 * 1024

/**
 * Downloads an incoming media message and stores it under
 * data/media/<sessionId>/<messageId>.<ext>. Returns the path *relative* to
 * MEDIA_ROOT (that is what we persist in the database).
 */
export async function storeIncomingMedia(
  sessionId: string,
  sock: WASocket,
  rawMessage: proto.IWebMessageInfo,
  mime: string | null | undefined,
  fileName?: string | null,
): Promise<{ mediaPath: string | null; mediaSize: number | null }> {
  try {
    const buffer = (await downloadMediaMessage(
      rawMessage,
      'buffer',
      {},
      {
        logger: baileysLogger,
        reuploadRequest: sock.updateMediaMessage,
      },
    )) as Buffer

    if (buffer.length > MAX_MEDIA_BYTES) {
      logger.warn(
        { size: buffer.length, sessionId },
        'media larger than WA_MAX_MEDIA_MB — keeping metadata only',
      )
      return { mediaPath: null, mediaSize: buffer.length }
    }

    const dir = await ensureDir(sessionMediaDir(sessionId))
    const id = sanitizeSegment(rawMessage.key?.id || `media-${Date.now()}`)
    const ext = guessExtension(mime, fileName)
    const absolute = path.join(dir, `${id}.${ext}`)

    await fs.writeFile(absolute, buffer)

    return {
      mediaPath: path.relative(MEDIA_ROOT, absolute),
      mediaSize: buffer.length,
    }
  } catch (error) {
    logger.warn({ error, sessionId }, 'failed to download incoming media')
    return { mediaPath: null, mediaSize: null }
  }
}
