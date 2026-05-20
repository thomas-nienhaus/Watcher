import { Server } from 'socket.io'
import type { Server as HTTPServer } from 'http'
import { registerSignalingHandlers } from './signaling'

export function attachSocketServer(httpServer: HTTPServer): void {
  // In production: default to same-origin only (false) — client and server
  // share the same Railway domain so cross-origin isn't needed.
  // In development: allow localhost. Set CORS_ORIGIN to override either way.
  const corsOrigin: string | false =
    process.env.CORS_ORIGIN ??
    (process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000')

  if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
    console.warn('[Socket] CORS_ORIGIN not set — using same-origin only (cross-origin blocked)')
  }

  const io = new Server(httpServer, {
    cors: corsOrigin === false ? false : { origin: corsOrigin, methods: ['GET', 'POST'] },
    perMessageDeflate: {
      threshold: 1024,
    },
    // 1MB max payload — SDP offers and ICE candidates are tiny
    maxHttpBufferSize: 1e6,
  })

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`)
    registerSignalingHandlers(io, socket)

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} (${reason})`)
    })
  })

  console.log('[Socket] Socket.IO server attached')
}
