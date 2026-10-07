import { z } from 'zod'
import { handle, ok } from '@/lib/api'
import { sessionManager } from '@/lib/baileys/session-manager'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  name: z.string().trim().max(60).optional(),
  phoneNumber: z
    .string()
    .trim()
    .min(8, 'Phone number is too short')
    .max(20, 'Phone number is too long'),
})

/** GET /api/sessions — dashboard list with per-session stats. */
export async function GET() {
  return handle(async () => {
    const sessions = await sessionManager.listSessions()
    return ok({ sessions })
  })
}

/**
 * POST /api/sessions
 * Creates the session *and* immediately starts the Baileys socket so the
 * pairing code can be requested in the very next call.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = createSchema.parse(await request.json())
    const session = await sessionManager.createSession(body)
    return ok({ session }, { status: 201 })
  })
}
