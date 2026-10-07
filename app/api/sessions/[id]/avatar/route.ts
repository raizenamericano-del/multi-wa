import { fail, handle, ok } from '@/lib/api'
import { sessionManager } from '@/lib/baileys/session-manager'
import { toJid } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sessions/:id/avatar?jid=<optional jid or phone number>
 * Returns the WhatsApp profile picture URL (empty when the contact hides it).
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = await sessionManager.getSession(params.id)
    if (!session) return fail('Session not found', 404)

    const url = new URL(request.url)
    const jidParam = url.searchParams.get('jid')

    let jid: string
    if (!jidParam) {
      jid = toJid(session.phoneNumber)
    } else if (jidParam.includes('@')) {
      jid = jidParam
    } else {
      jid = toJid(jidParam)
    }

    const pictureUrl = await sessionManager.profilePicture(params.id, jid)
    return ok({ jid, url: pictureUrl })
  })
}
