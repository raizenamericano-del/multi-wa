import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import { fail } from '@/lib/api'
import { mediaAbsolutePath } from '@/lib/baileys/paths'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const SAFE_INLINE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
  'application/pdf',
]

/**
 * GET /api/media?id=<messageId>[&download=1]
 * Streams a stored media file. Paths are always resolved inside
 * data/media — traversal is impossible, see mediaAbsolutePath().
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const messageId = url.searchParams.get('id')
  const asDownload = url.searchParams.get('download') === '1'

  if (!messageId) return fail('Missing ?id=<messageId>', 422)

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { mediaPath: true, mediaMime: true, mediaName: true, type: true },
  })

  if (!message?.mediaPath) return fail('Media not found', 404)

  let absolute: string
  try {
    absolute = mediaAbsolutePath(message.mediaPath)
  } catch {
    return fail('Invalid media path', 400)
  }

  try {
    const stat = await fs.stat(absolute)
    const stream = createReadStream(absolute)
    const mime = message.mediaMime ?? 'application/octet-stream'

    const fallbackName = `media-${messageId}`
    const fileName = (message.mediaName ?? `${fallbackName}`).replace(/["\r\n]/g, '')

    const headers: Record<string, string> = {
      'content-type': mime,
      'content-length': String(stat.size),
      'cache-control': 'private, max-age=3600',
      'accept-ranges': 'bytes',
    }

    if (asDownload || !SAFE_INLINE_TYPES.includes(mime.split(';')[0])) {
      headers['content-disposition'] = `attachment; filename="${fileName}"`
    }

    return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, { headers })
  } catch {
    return fail('Media file is missing on disk', 404)
  }
}
