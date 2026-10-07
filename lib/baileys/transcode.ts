import { spawn } from 'node:child_process'
import { logger } from '@/lib/logger'

let ffmpegAvailable: boolean | null = null

function ffmpegPath() {
  return process.env.FFMPEG_PATH || 'ffmpeg'
}

/** Probe ffmpeg once and cache the result for the lifetime of the process. */
export async function hasFfmpeg() {
  if (ffmpegAvailable !== null) return ffmpegAvailable
  ffmpegAvailable = await new Promise<boolean>((resolve) => {
    const child = spawn(ffmpegPath(), ['-version'])
    child.on('error', () => resolve(false))
    child.on('close', (code) => resolve(code === 0))
  })
  if (!ffmpegAvailable) {
    logger.warn(
      'ffmpeg not found on PATH — voice notes will be forwarded without Opus/OGG transcoding. ' +
        'Install ffmpeg (Dockerfile does this automatically) for full voice note support.',
    )
  }
  return ffmpegAvailable
}

/**
 * Converts any audio buffer (usually audio/webm;codecs=opus from the browser's
 * MediaRecorder) into a real WhatsApp voice note: mono 48kHz OGG/Opus.
 */
export async function toOggOpus(input: Buffer): Promise<Buffer | null> {
  if (!(await hasFfmpeg())) return null

  return new Promise<Buffer | null>((resolve) => {
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      'pipe:0',
      '-vn',
      '-c:a',
      'libopus',
      '-b:a',
      '48k',
      '-ar',
      '48000',
      '-ac',
      '1',
      '-application',
      'voip',
      '-f',
      'ogg',
      'pipe:1',
    ]

    const child = spawn(ffmpegPath(), args)
    const chunks: Buffer[] = []
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      logger.warn({ error }, 'ffmpeg failed to start')
      resolve(null)
    })
    child.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks))
      } else {
        logger.warn({ code, stderr: stderr.slice(0, 500) }, 'ffmpeg transcode failed')
        resolve(null)
      }
    })

    child.stdin.end(input)
  })
}

/** Best-effort duration (seconds) read from an OGG/Opus container. */
export function guessOggDuration(buffer: Buffer) {
  // The last OGG page usually carries a granule position we can use, but it is
  // not worth a full parser: WhatsApp reads the duration itself when sending.
  return null
}
