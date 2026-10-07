import fs from 'node:fs/promises'
import path from 'node:path'
import { makeCacheableSignalKeyStore, useMultiFileAuthState } from '@whiskeysockets/baileys'
import { baileysLogger } from '@/lib/logger'
import { ensureDir, sessionAuthDir } from './paths'

export interface SessionAuthState {
  dir: string
  state: {
    creds: Awaited<ReturnType<typeof useMultiFileAuthState>>['state']['creds']
    keys: ReturnType<typeof makeCacheableSignalKeyStore>
  }
  saveCreds: () => Promise<void>
}

/**
 * Baileys auth state persisted with the official multi-file store
 * (data/auth/<sessionId>/creds.json + key files).
 *
 * The signal key store is wrapped with an in-memory cache because Next.js and
 * Socket.io hit it from many async contexts; without the cache WhatsApp can
 * throttle us with 429s on very active accounts.
 */
export async function createAuthState(sessionId: string): Promise<SessionAuthState> {
  const dir = await ensureDir(sessionAuthDir(sessionId))
  const { state, saveCreds } = await useMultiFileAuthState(dir)

  return {
    dir,
    state: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
    },
    saveCreds,
  }
}

/** true when a previous login exists on disk for this session. */
export async function hasStoredCreds(sessionId: string) {
  try {
    await fs.access(path.join(sessionAuthDir(sessionId), 'creds.json'))
    return true
  } catch {
    return false
  }
}

/** Used by "Logout / Unlink" — wipes the auth files so the number is unlinked. */
export async function removeAuthState(sessionId: string) {
  const dir = sessionAuthDir(sessionId)
  await fs.rm(dir, { recursive: true, force: true })
  return dir
}
