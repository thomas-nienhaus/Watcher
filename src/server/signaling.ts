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

// Reverse lookup: cameraSocketId → roomCode — O(1) instead of O(n) linear scan
const cameraToRoom = new Map<string, string>()

// Reverse lookup: viewerSocketId → roomCode
const viewerToRoom = new Map<string, string>()

const rateLimitMap = new Map<string, RateLimitState>()

// Purge stale rate-limit entries every 60s to prevent unbounded map growth
setInterval(() => {
  const staleThreshold = Date.now() - 5000
  for (const [id, state] of rateLimitMap) {
    if (state.windowStart < staleThreshold) rateLimitMap.delete(id)
  }
}, 60_000).unref()

const ROOM_EXPIRY_MS = parseInt(process.env.ROOM_EXPIRY_MS ?? '28800000', 10)
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

function deleteRoom(roomCode: string): void {
  const room = rooms.get(roomCode)
  if (room) {
    clearTimeout(room.expiryTimeout)
    cameraToRoom.delete(room.cameraSocketId)
    rooms.delete(roomCode)
  }
}

export function registerSignalingHandlers(io: Server, socket: Socket): void {
  // ── Camera: create room ──────────────────────────────────────────────────
  socket.on('join-room', ({ roomCode }: { roomCode: string }) => {
    // Rate-limit room creation to prevent enumeration attacks
    if (isRateLimited(socket.id)) return

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
        deleteRoom(roomCode)
      }
    }, ROOM_EXPIRY_MS)

    rooms.set(roomCode, {
      cameraSocketId: socket.id,
      viewers: new Set(),
      createdAt: Date.now(),
      expiryTimeout,
    })
    cameraToRoom.set(socket.id, roomCode)

    socket.emit('room-joined', { roomCode })
    console.log(`[Room] Created: ${roomCode} by ${socket.id}`)
  })

  // ── Viewer: join existing room ───────────────────────────────────────────
  socket.on('viewer-join', ({ roomCode }: { roomCode: string }) => {
    if (isRateLimited(socket.id)) return

    if (!roomCode || !/^[A-Z2-9]{6}$/.test(roomCode)) {
      socket.emit('room-error', { message: 'Invalid room code format' })
      return
    }

    const room = rooms.get(roomCode)
    if (!room) {
      socket.emit('room-error', { message: 'Room not found — check the code and try again' })
      return
    }

    socket.join(roomCode)
    room.viewers.add(socket.id)
    viewerToRoom.set(socket.id, roomCode)

    // Tell the camera a viewer has joined so it can create an offer
    io.to(room.cameraSocketId).emit('viewer-joined', {
      viewerSocketId: socket.id,
      viewerCount: room.viewers.size,
    })

    // Tell the viewer who the camera is so it can handle incoming offers
    socket.emit('room-joined', { cameraSocketId: room.cameraSocketId })
    console.log(`[Room] Viewer ${socket.id} joined ${roomCode} (total: ${room.viewers.size})`)
  })

  // ── WebRTC offer: camera → specific viewer ───────────────────────────────
  socket.on(
    'offer',
    ({ offer, targetSocketId }: { offer: SessionDescription; targetSocketId: string }) => {
      if (isRateLimited(socket.id)) return

      // Verify sender is the camera for a room that contains the target viewer
      const roomCode = cameraToRoom.get(socket.id)
      const room = roomCode ? rooms.get(roomCode) : undefined
      if (!room || !room.viewers.has(targetSocketId)) return

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

      // Verify sender is a viewer in the camera's room
      const roomCode = cameraToRoom.get(cameraSocketId)
      const room = roomCode ? rooms.get(roomCode) : undefined
      if (!room || !room.viewers.has(socket.id)) return

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

      // Verify sender and target share a room (camera↔viewer or viewer↔camera)
      const senderIsCamera = cameraToRoom.has(socket.id)
      if (senderIsCamera) {
        // Camera sending to viewer: verify target is a viewer in sender's room
        const roomCode = cameraToRoom.get(socket.id)!
        const room = rooms.get(roomCode)
        if (!room || !room.viewers.has(targetSocketId)) return
      } else {
        // Viewer sending to camera: verify target is the camera of a room containing sender
        const roomCode = cameraToRoom.get(targetSocketId)
        const room = roomCode ? rooms.get(roomCode) : undefined
        if (!room || !room.viewers.has(socket.id)) return
      }

      io.to(targetSocketId).emit('ice-candidate-received', {
        candidate,
        fromSocketId: socket.id,
      })
    }
  )

  // ── Audio level: camera → all viewers ────────────────────────────────────
  socket.on('audio-activity', (payload: { level: number; isActive: boolean }) => {
    if (isRateLimited(socket.id)) return
    const roomCode = cameraToRoom.get(socket.id)
    if (roomCode) {
      socket.to(roomCode).emit('audio-activity', payload)
    }
  })

  // ── Battery level: camera → all viewers ──────────────────────────────────
  socket.on('battery-update', (payload: { level: number; charging: boolean }) => {
    if (isRateLimited(socket.id)) return
    const roomCode = cameraToRoom.get(socket.id)
    if (roomCode) {
      socket.to(roomCode).emit('battery-update', payload)
    }
  })

  // ── Camera settings: camera → all viewers ────────────────────────────────
  socket.on('camera-settings', (payload: { isMicMuted: boolean; isNightMode: boolean }) => {
    if (isRateLimited(socket.id)) return
    const roomCode = cameraToRoom.get(socket.id)
    if (roomCode) {
      socket.to(roomCode).emit('camera-settings-received', payload)
    }
  })

  // ── Sleep sound command: viewer → camera ──────────────────────────────────
  socket.on('sleep-sound-command', (payload: { sound: string; volume: number }) => {
    if (isRateLimited(socket.id)) return
    const roomCode = viewerToRoom.get(socket.id)
    const room = roomCode ? rooms.get(roomCode) : undefined
    if (!room) return
    io.to(room.cameraSocketId).emit('sleep-sound-command', payload)
  })

  // ── Sleep sound state: camera → all viewers ───────────────────────────────
  socket.on('sleep-sound-state', (payload: { sound: string; volume: number }) => {
    if (isRateLimited(socket.id)) return
    const roomCode = cameraToRoom.get(socket.id)
    if (roomCode) {
      socket.to(roomCode).emit('sleep-sound-state', payload)
    }
  })

  // ── Cleanup on disconnect ─────────────────────────────────────────────────
  socket.on('disconnect', () => {
    rateLimitMap.delete(socket.id)

    // Camera disconnected — O(1) lookup via reverse map
    const ownedRoomCode = cameraToRoom.get(socket.id)
    if (ownedRoomCode) {
      io.to(ownedRoomCode).emit('camera-disconnected', {})
      deleteRoom(ownedRoomCode)
      console.log(`[Room] Deleted: ${ownedRoomCode} (camera disconnected)`)
      return
    }

    // Viewer disconnected — O(1) lookup via reverse map
    viewerToRoom.delete(socket.id)
    for (const [roomCode, room] of rooms) {
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
