import { ok } from '@/lib/api'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  let database = 'unknown'
  try {
    await prisma.$queryRaw`SELECT 1`
    database = 'up'
  } catch {
    database = 'down'
  }

  return ok({
    status: 'ok',
    service: 'wa-multi-device-controller',
    database,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    node: process.version,
  })
}
