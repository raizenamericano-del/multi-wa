import { z } from 'zod'
import { fail, handle, ok } from '@/lib/api'
import { sessionManager } from '@/lib/baileys/session-manager'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  read: z.boolean().optional(),
})

export async function GET(_request: Request, { params }: { params: { chatId: string } }) {
  return handle(async () => {
    const chat = await sessionManager.getChat(params.chatId)
    if (!chat) return fail('Chat not found', 404)
    return ok({ chat })
  })
}

/** PATCH /api/chats/:chatId — pin / archive / mark as read. */
export async function PATCH(request: Request, { params }: { params: { chatId: string } }) {
  return handle(async () => {
    const body = patchSchema.parse(await request.json())
    const chat = await sessionManager.getChat(params.chatId)
    if (!chat) return fail('Chat not found', 404)

    if (body.read) {
      await sessionManager.markChatRead(chat.sessionId, chat.id)
    }

    const updated = await sessionManager.updateChat(chat.id, {
      pinned: body.pinned,
      archived: body.archived,
    })

    return ok({ chat: updated })
  })
}
