import { Server, Socket } from 'socket.io'

// Minimal WebRTC payload shapes — the server only forwards these, never inspects them
interface SessionDescription {
  type: string
  sdp: string
}

interface IceCandidate {
  candidate: string
  sdpMid?: string | null
  sdpMLineIndex?: number | null
}

// Types declared inline — server tsconfig cannot share moduleResolution with Next.js
interface RoomState {
  cameraSocketId: string
  viewers: Set<string>
  createdAt: number
  expiryTimeout: ReturnType<typeof setTimeout>
}

interface RateLimitState {
  count: number
  windowStart: number
}

const rooms = new Map<string, RoomState>()
const rateLimitMap = new Map<string, RateLimitState>()

const ROOM_EXPIRY_MS = parseInt(process.env.ROOM_EXPIRY_MS ?? '1800000', 10)
const MAX_ROOMS = parseInt(process.env.MAX_ROOMS ?? '1000', 10)
const MAX_EVENTS_PER_SECOND = parseInt(
  process.env.RATE_LIMIT_EVENTS_PER_SECOND ?? '10',
  10
)

function isRateLimited(socketId: string): boolean {
  const now = Date.now()
  const state = rateLimitMap.get(socketId) ?? { count: 0, windowStart: now }

  if (now - state.windowStart > 1000) {
    rateLimitMap.set(socketId, { count: 1, windowStart: now })
    return false
  }

  if (state.count >= MAX_EVENTS_PER_SECOND) return true

  rateLimitMap.set(socketId, { ...state, count: state.count + 1 })
  return false
}

function findRoomByCamera(socketId: string): [string, RoomState] | undefined {
  for (const entry of rooms) {
    if (entry[1].cameraSocketId === socketId) return entry
  }
  return undefined
}

export function registerSignalingHandlers(io: Server, socket: Socket): void {
  // ── Camera: create room ──────────────────────────────────────────────────
  socket.on('join-room', ({ roomCode }: { roomCode: string }) => {
    if (!roomCode || !/^[A-Z2-9]{6}$/.test(roomCode)) {
      socket.emit('room-error', { message: 'Invalid room code format' })
      return
    }
    if (rooms.size >= MAX_ROOMS) {
      socket.emit('room-error', { message: 'Server at capacity, try again later' })
      return
    }
    if (rooms.has(roomCode)) {
      socket.emit('room-error', { message: 'Room code already in use' })
      return
    }

    socket.join(roomCode)

    const expiryTimeout = setTimeout(() => {
      if (rooms.has(roomCode)) {
        io.to(roomCode).emit('room-error', { message: 'Room expired' })
        rooms.delete(roomCode)
      }
    }, ROOM_EXPIRY_MS)

    rooms.set(roomCode, {
      cameraSocketId: socket.id,
      viewers: new Set(),
      createdAt: Date.now(),
      expiryTimeout,
    })

    socket.emit('room-joined', { roomCode })
    console.log(`[Room] Created: ${roomCode} by ${socket.id}`)
  })

  // ── Viewer: join existing room ───────────────────────────────────────────
  socket.on('viewer-join', ({ roomCode }: { roomCode: string }) => {
    if (isRateLimited(socket.id)) return

    const room = rooms.get(roomCode)
    if (!room) {
      socket.emit('room-error', { message: 'Room not found — check the code and try again' })
      return
    }

    socket.join(roomCode)
    room.viewers.add(socket.id)

    // Tell the camera a viewer has joined so it can create an offer
    io.to(room.cameraSocketId).emit('viewer-joined', {
      viewerSocketId: socket.id,
      viewerCount: room.viewers.size,
    })

    // Tell the viewer who the camera is so it can handle incoming offers
    socket.emit('room-joined', { cameraSocketId: room.cameraSocketId })
    console.log(`[Room] Viewer ${socket.id} joined ${roomCode} (total: ${room.viewers.size})`)
  })

  // ── WebRTC offer: camera → viewer ────────────────────────────────────────
  socket.on(
    'offer',
    ({ offer, targetSocketId }: { offer: SessionDescription; targetSocketId: string }) => {
      if (isRateLimited(socket.id)) return
      io.to(targetSocketId).emit('offer-received', {
        offer,
        cameraSocketId: socket.id,
      })
    }
  )

  // ── WebRTC answer: viewer → camera ───────────────────────────────────────
  socket.on(
    'answer',
    ({ answer, cameraSocketId }: { answer: SessionDescription; cameraSocketId: string }) => {
      if (isRateLimited(socket.id)) return
      io.to(cameraSocketId).emit('answer-received', {
        answer,
        viewerSocketId: socket.id,
      })
    }
  )

  // ── ICE candidates: bidirectional relay ──────────────────────────────────
  socket.on(
    'ice-candidate',
    ({ candidate, targetSocketId }: { candidate: IceCandidate; targetSocketId: string }) => {
      if (isRateLimited(socket.id)) return
      io.to(targetSocketId).emit('ice-candidate-received', {
        candidate,
        fromSocketId: socket.id,
      })
    }
  )

  // ── Audio level: camera → all viewers ────────────────────────────────────
  socket.on('audio-activity', (payload: { level: number; isActive: boolean }) => {
    if (isRateLimited(socket.id)) return
    const entry = findRoomByCamera(socket.id)
    if (entry) {
      socket.to(entry[0]).emit('audio-activity', payload)
    }
  })

  // ── Battery level: camera → all viewers ──────────────────────────────────
  socket.on('battery-update', (payload: { level: number; charging: boolean }) => {
    const entry = findRoomByCamera(socket.id)
    if (entry) {
      socket.to(entry[0]).emit('battery-update', payload)
    }
  })

  // ── Cleanup on disconnect ─────────────────────────────────────────────────
  socket.on('disconnect', () => {
    rateLimitMap.delete(socket.id)

    for (const [roomCode, room] of rooms) {
      if (room.cameraSocketId === socket.id) {
        clearTimeout(room.expiryTimeout)
        io.to(roomCode).emit('camera-disconnected', {})
        rooms.delete(roomCode)
        console.log(`[Room] Deleted: ${roomCode} (camera disconnected)`)
        break
      }
      if (room.viewers.has(socket.id)) {
        room.viewers.delete(socket.id)
        io.to(room.cameraSocketId).emit('viewer-left', {
          viewerSocketId: socket.id,
          viewerCount: room.viewers.size,
        })
        break
      }
    }
  })
}
