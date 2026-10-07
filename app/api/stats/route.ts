import { handle, ok } from '@/lib/api'
import { sessionManager } from '@/lib/baileys/session-manager'

export const dynamic = 'force-dynamic'

/** GET /api/stats — the numbers shown on the dashboard hero. */
export async function GET() {
  return handle(async () => {
    const stats = await sessionManager.stats()
    return ok({ stats })
  })
}
