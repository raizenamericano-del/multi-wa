import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * All runtime state (Baileys auth files + downloaded media) lives under
 * `data/` by default. On Railway, attach a Volume mounted at /app/data so that
 * WhatsApp sessions survive every redeploy.
 */
export const DATA_DIR = path.resolve(
  process.env.WA_DATA_DIR || path.join(process.cwd(), 'data'),
)
export const AUTH_ROOT = path.resolve(process.env.WA_AUTH_DIR || path.join(DATA_DIR, 'auth'))
export const MEDIA_ROOT = path.resolve(process.env.WA_MEDIA_DIR || path.join(DATA_DIR, 'media'))

/** Keep these two in sync with .gitignore — they must never be committed. */
export const PROTECTED_DIRS = ['auth', 'media']

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export function sessionAuthDir(sessionId: string) {
  return path.join(AUTH_ROOT, sanitizeSegment(sessionId))
}

export function sessionMediaDir(sessionId: string) {
  return path.join(MEDIA_ROOT, sanitizeSegment(sessionId))
}

export async function ensureBaseDirs() {
  await ensureDir(AUTH_ROOT)
  await ensureDir(MEDIA_ROOT)
}

/** Prevent path traversal from any id coming from the outside world. */
export function sanitizeSegment(segment: string) {
  return segment.replace(/[^a-zA-Z0-9_-]/g, '_')
}

/**
 * Media paths are stored in the database relative to MEDIA_ROOT
 * (e.g. `cm123/3EB0A1B2.jpg`) and resolved safely here.
 */
export function mediaAbsolutePath(relativePath: string) {
  const absolute = path.resolve(MEDIA_ROOT, relativePath)
  if (!absolute.startsWith(MEDIA_ROOT)) {
    throw new Error('Invalid media path')
  }
  return absolute
}

export function guessExtension(mime?: string | null, fileName?: string | null) {
  const fromName = fileName?.match(/\.([a-zA-Z0-9]{2,5})$/)?.[1]
  if (fromName) return fromName.toLowerCase()
  if (!mime) return 'bin'
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/zip': 'zip',
    'text/plain': 'txt',
  }
  return map[mime.toLowerCase()] ?? mime.split('/')[1]?.replace(/[^a-z0-9]/gi, '').slice(0, 5) ?? 'bin'
}
