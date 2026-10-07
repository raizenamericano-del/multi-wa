import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { logger } from '@/lib/logger'

/** Every API route in this app is dynamic (they all touch the DB / Baileys). */
export const dynamic = 'force-dynamic'

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as unknown as Record<string, unknown>, init)
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

/**
 * Wraps a route handler with JSON error handling so the client always receives
 * `{ error: string }` instead of an HTML stack trace.
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof ZodError) {
      return fail(error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', '), 422)
    }

    const message = error instanceof Error ? error.message : String(error)
    logger.error({ error }, 'api error')

    const notFound = /not found/i.test(message)
    return fail(message, notFound ? 404 : 500)
  }
}

export function parseBoolean(value: string | null | undefined) {
  if (value === null || value === undefined) return undefined
  return value === 'true' || value === '1'
}
