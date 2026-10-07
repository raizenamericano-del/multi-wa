import { PrismaClient } from '@prisma/client'

/**
 * Prisma is a singleton stored on globalThis so that:
 *  - Next.js HMR in dev does not open a new pool on every reload
 *  - the custom server (server.ts) and the Next route handlers share the
 *    same client instance even though they live in different module graphs.
 */
const globalForPrisma = globalThis as unknown as {
  __waPrisma?: PrismaClient
}

export const prisma: PrismaClient =
  globalForPrisma.__waPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'],
  })

globalForPrisma.__waPrisma = prisma

export default prisma
