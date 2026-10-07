import pino from 'pino'

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

/**
 * Shared pino logger. Railway renders JSON logs nicely, so we keep the default
 * JSON output (no pretty printer) to avoid extra dependencies on the server.
 */
export const logger = pino({
  level,
  name: 'wa-controller',
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  // Make sure `logger.error({ error }, 'msg')` prints the message + stack
  // instead of an empty object (Railway logs are the only debugging surface).
  serializers: {
    error: pino.stdSerializers.err,
    err: pino.stdSerializers.err,
  },
})

/** Baileys is extremely chatty — keep it quiet unless the user asks for trace. */
export const baileysLogger = logger.child({ module: 'baileys' })

export type Logger = typeof logger
