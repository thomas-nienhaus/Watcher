import { Server } from 'socket.io'
import type { Server as HTTPServer } from 'http'
import { registerSignalingHandlers } from './signaling'

export function attachSocketServer(httpServer: HTTPServer): void {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN ?? '*',
      methods: ['GET', 'POST'],
    },
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
