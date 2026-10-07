import { z } from 'zod'
import { fail, handle, ok } from '@/lib/api'
import { sessionManager } from '@/lib/baileys/session-manager'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    phoneNumber: z.string().trim().min(8).max(20).optional(),
  })
  .default({})

/**
 * POST /api/sessions/:id/pairing-code
 * Body: { phoneNumber?: string }
 *
 * Starts the Baileys socket (if it is not running yet), asks WhatsApp for a
 * 6-digit pairing code and streams it to the UI over Socket.io.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = await sessionManager.getSession(params.id)
    if (!session) return fail('Session not found', 404)

    let body: z.infer<typeof bodySchema> = {}
    try {
      body = bodySchema.parse(await request.json())
    } catch {
      body = {}
    }

    const result = await sessionManager.requestPairingCode(params.id, body.phoneNumber)

    const updated = await prisma.waSession.findUnique({ where: { id: params.id } })
    return ok({
      pairingCode: result.code,
      expiresAt: result.expiresAt,
      status: updated?.status ?? 'pairing',
      phoneNumber: updated?.phoneNumber ?? session.phoneNumber,
    })
  })
}
