import { fail, handle, ok } from '@/lib/api'
import { sessionManager } from '@/lib/baileys/session-manager'

export const dynamic = 'force-dynamic'

/** POST /api/sessions/:id/disconnect — closes the socket, keeps credentials. */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = await sessionManager.getSession(params.id)
    if (!session) return fail('Session not found', 404)

    await sessionManager.disconnect(params.id)
    const updated = await sessionManager.getSession(params.id)
    return ok({ session: updated })
  })
}
