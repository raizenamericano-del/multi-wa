/**
 * Custom Next.js server.
 *
 * Why a custom server?
 *  - Socket.io needs the underlying HTTP server to attach its websocket
 *    upgrade handler (Next's built-in server does not expose it).
 *  - Baileys sockets are long-lived and must live in the same process as the
 *    API route handlers that control them.
 *
 * Everything still ships as ONE Railway service and ONE `npm start`.
 */
import { createServer } from 'node:http'
import next from 'next'
import { Server as IOServer } from 'socket.io'
import { logger } from './lib/logger'
import { sessionManager } from './lib/baileys/session-manager'
import {
  SOCKET_PATH,
  registerSocketGateway,
  setHttpServer,
} from './lib/socket-server'
import type { ClientToServerEvents, ServerToClientEvents } from './lib/types'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = Number(process.env.PORT || 3000)

async function main() {
  const app = next({ dev, hostname, port, dir: process.cwd() })
  await app.prepare()
  const handle = app.getRequestHandler()

  const httpServer = createServer((req, res) => {
    // Tiny health probe so Railway / uptime bots do not need Next to warm up.
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, uptime: process.uptime() }))
      return
    }
    void handle(req, res)
  })

  const io = new IOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: SOCKET_PATH,
    addTrailingSlash: false,
    // The dashboard talks to the same origin, so no CORS restriction is needed;
    // behind Railway's proxy the origin header differs from localhost, hence *.
    cors: { origin: true, credentials: true },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 30000,
  })

  setHttpServer(httpServer)
  await registerSocketGateway(io)

  httpServer.listen(port, hostname, () => {
    logger.info(`▲ ready on http://${hostname}:${port} (${dev ? 'development' : 'production'})`)
    logger.info(`socket.io path: ${SOCKET_PATH}`)
  })

  // Bring back previously connected WhatsApp sessions.
  void sessionManager.boot().catch((error) => {
    logger.error({ error }, 'session restore failed')
  })

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down')
    await sessionManager.shutdown().catch(() => undefined)
    httpServer.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 5000).unref()
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((error) => {
  logger.error({ error }, 'fatal: server failed to start')
  process.exit(1)
})
