import { z } from 'zod'
import { fail, handle, ok, parseBoolean } from '@/lib/api'
import { sessionManager } from '@/lib/baileys/session-manager'

export const dynamic = 'force-dynamic'

/** GET /api/sessions/:id/chats?search=&archived= */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = await sessionManager.getSession(params.id)
    if (!session) return fail('Session not found', 404)

    const url = new URL(request.url)
    const chats = await sessionManager.listChats(params.id, {
      search: url.searchParams.get('search') ?? undefined,
      archived: parseBoolean(url.searchParams.get('archived')),
    })

    return ok({ chats })
  })
}

const openSchema = z.object({
  phoneNumber: z.string().trim().min(8).max(20),
})

/**
 * POST /api/sessions/:id/chats
 * Body: { phoneNumber: "6281234567890" } — starts (or reopens) a 1:1 chat.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = await sessionManager.getSession(params.id)
    if (!session) return fail('Session not found', 404)

    const body = openSchema.parse(await request.json())
    const chat = await sessionManager.openChatByNumber(params.id, body.phoneNumber)
    return ok({ chat }, { status: 201 })
  })
}
