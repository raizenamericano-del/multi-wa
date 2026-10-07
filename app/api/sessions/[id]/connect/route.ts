import { fail, handle, ok } from '@/lib/api'
import { sessionManager } from '@/lib/baileys/session-manager'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sessions/:id/connect
 * Reopens the socket using the stored credentials (used by the auto-reconnect
 * button on the dashboard, or right after the pairing flow).
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = await sessionManager.getSession(params.id)
    if (!session) return fail('Session not found', 404)

    if (sessionManager.isLive(params.id) && session.status === 'connected') {
      return ok({ session, already: true })
    }

    await sessionManager.startSocket(params.id, { fresh: false })
    const updated = await sessionManager.getSession(params.id)
    return ok({ session: updated })
  })
}
