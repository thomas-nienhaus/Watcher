// ICE config is fetched server-side so TURN credentials never appear in the client bundle.
let iceServersCache: RTCIceServer[] | null = null

const DEFAULT_ICE: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

export async function prefetchIceServers(): Promise<void> {
  if (iceServersCache) return
  try {
    const res = await fetch('/api/ice-config')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { iceServers } = await res.json()
    iceServersCache = iceServers
  } catch (err) {
    console.warn('[WebRTC] Could not fetch ICE config, using default STUN:', err)
    iceServersCache = DEFAULT_ICE
  }
}

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers: iceServersCache ?? DEFAULT_ICE,
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',  // force audio+video onto one ICE transport
  })
}

export function addStreamTracks(
  pc: RTCPeerConnection,
  stream: MediaStream
): void {
  stream.getTracks().forEach((track) => {
    pc.addTrack(track, stream)
  })
}
