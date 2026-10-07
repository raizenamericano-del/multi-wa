import { z } from 'zod'
import { fail, handle, ok } from '@/lib/api'
import { sessionManager } from '@/lib/baileys/session-manager'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60),
})

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = await sessionManager.getSession(params.id)
    if (!session) return fail('Session not found', 404)
    return ok({ session })
  })
}

/** PATCH /api/sessions/:id — rename a session. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const body = patchSchema.parse(await request.json())
    const session = await sessionManager.getSession(params.id)
    if (!session) return fail('Session not found', 404)

    await prisma.waSession.update({
      where: { id: params.id },
      data: { name: body.name },
    })

    const updated = await sessionManager.getSession(params.id)
    return ok({ session: updated })
  })
}

/** DELETE /api/sessions/:id — unlink + delete session, chats, messages and media. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const session = await sessionManager.getSession(params.id)
    if (!session) return fail('Session not found', 404)
    await sessionManager.deleteSession(params.id)
    return ok({ deleted: true, id: params.id })
  })
}
