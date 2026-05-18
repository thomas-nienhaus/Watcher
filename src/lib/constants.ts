export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  // TURN server injected if configured via env
  ...(process.env.NEXT_PUBLIC_TURN_URL
    ? [
        {
          urls: process.env.NEXT_PUBLIC_TURN_URL,
          username: process.env.NEXT_PUBLIC_TURN_USERNAME ?? '',
          credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL ?? '',
        } as RTCIceServer,
      ]
    : []),
]

export const AUDIO_DETECTION = {
  FFT_SIZE: 256,
  DEFAULT_THRESHOLD: 30,      // 0–100 scale; below this = quiet
  SUSTAINED_DURATION_MS: 2000, // must be loud for 2s to trigger alert
  EMIT_INTERVAL_MS: 200,       // max emit frequency
} as const

export const ROOM = {
  CODE_LENGTH: 6,
} as const

export const SOCKET_EVENTS = {
  // Client → Server
  JOIN_ROOM: 'join-room',
  VIEWER_JOIN: 'viewer-join',
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE_CANDIDATE: 'ice-candidate',
  AUDIO_ACTIVITY: 'audio-activity',
  BATTERY_UPDATE: 'battery-update',
  // Server → Client
  ROOM_JOINED: 'room-joined',
  VIEWER_JOINED: 'viewer-joined',
  VIEWER_LEFT: 'viewer-left',
  OFFER_RECEIVED: 'offer-received',
  ANSWER_RECEIVED: 'answer-received',
  ICE_CANDIDATE_RECEIVED: 'ice-candidate-received',
  AUDIO_ACTIVITY_RECEIVED: 'audio-activity',   // same name, different direction
  BATTERY_UPDATE_RECEIVED: 'battery-update',
  ROOM_ERROR: 'room-error',
  CAMERA_DISCONNECTED: 'camera-disconnected',
} as const
