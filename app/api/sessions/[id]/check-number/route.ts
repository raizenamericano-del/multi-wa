import { z } from 'zod'
import { fail, handle, ok } from '@/lib/api'
import { sessionManager } from '@/lib/baileys/session-manager'

export const dynamic = 'force-dynamic'

const schema = z.object({
  phoneNumber: z.string().trim().min(8).max(20),
})

/** POST /api/sessions/:id/check-number — is this number on WhatsApp? */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = await sessionManager.getSession(params.id)
    if (!session) return fail('Session not found', 404)

    const body = schema.parse(await request.json())
    const result = await sessionManager.checkNumber(params.id, body.phoneNumber)
    return ok(result)
  })
}
