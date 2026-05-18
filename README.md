# BabyWatch

A production-ready PWA baby monitor that works entirely in the browser. One device streams live video + audio; one or more devices receive the feed — all peer-to-peer via WebRTC.

## Features

- **Camera device**: captures live video + audio, displays room code + QR code
- **Viewer device**: enters room code, receives full-screen live feed
- **Audio activity detection**: detects sustained sound, alerts viewer
- **Night mode**: red-tinted dim UI for use in a dark room
- **Wake lock**: keeps screen on during streaming (with NoSleep.js fallback for iOS Safari)
- **Battery status**: camera device battery level shown on viewer
- **QR code sharing**: scan to connect viewer instantly
- **Multiple viewers**: up to 3–4 simultaneous viewers (mesh WebRTC)
- **PWA**: installable on iPhone/iPad via "Add to Home Screen"
- **Privacy**: video is never recorded or stored; sessions are temporary

---

## iOS Safari Limitations

Safari on iOS has restrictions that cannot be fully worked around in a web app:

| Limitation | Behaviour | Workaround |
|---|---|---|
| Screen lock | Stops camera stream | Wake Lock API + NoSleep.js video trick |
| Background tab | Freezes WebRTC | Warning banner; re-acquire lock on return |
| AudioContext | Requires user gesture | `initAudioContext()` called inside button click |
| Autoplay | Requires `muted` initially | Start muted; user taps to unmute |

**Recommendation**: Install the app to the Home Screen (Safari → Share → Add to Home Screen) for the best iOS experience.

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+

### Local Development

```bash
# Install dependencies
npm install

# Copy and edit environment variables
cp .env.example .env.local
# Edit NEXT_PUBLIC_SOCKET_URL=http://localhost:3000

# Start development server (Next.js + Socket.IO on port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in two browser tabs:
- Tab 1 → "Set Up Camera" → allow camera access → note the room code
- Tab 2 → "Watch Feed" → enter the room code → see the live feed

### Generate Icons

```bash
node scripts/generate-png-icons.js
```

---

## Deployment

### Railway (recommended)

1. Push this repo to GitHub
2. Create a new Railway project → "Deploy from GitHub repo"
3. Set environment variables (see below)
4. Railway auto-detects `railway.json` and runs `npm run build && npm start`

### Fly.io

```bash
fly launch
fly secrets set NEXT_PUBLIC_SOCKET_URL=https://your-app.fly.dev
fly secrets set CORS_ORIGIN=https://your-app.fly.dev
fly deploy
```

### Docker

```bash
docker build -t babywatch .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SOCKET_URL=http://localhost:3000 \
  babywatch
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:3000` | Full URL of the signaling server (same as the app URL) |
| `NEXT_PUBLIC_TURN_URL` | _(empty)_ | Optional TURN server URL, e.g. `turn:your.server:3478` |
| `NEXT_PUBLIC_TURN_USERNAME` | _(empty)_ | TURN username |
| `NEXT_PUBLIC_TURN_CREDENTIAL` | _(empty)_ | TURN credential |
| `ROOM_EXPIRY_MS` | `1800000` | Room TTL in milliseconds (30 minutes) |
| `MAX_ROOMS` | `1000` | Max concurrent rooms |
| `RATE_LIMIT_EVENTS_PER_SECOND` | `10` | Socket.IO rate limit per connection |
| `CORS_ORIGIN` | `*` | Restrict WebSocket CORS in production |
| `PORT` | `3000` | HTTP port (set automatically by Railway) |

---

## Architecture

```
Browser (Camera device)          Browser (Viewer device)
        │                                 │
        │     Socket.IO signaling         │
        ├─────────────────────────────────┤
        │         Railway server          │
        │  (Next.js + Express + Socket.IO)│
        │                                 │
        │     WebRTC (peer-to-peer)       │
        └─────────────────────────────────┘
                 Video + Audio
```

### Signaling flow

1. Camera emits `join-room` with a 6-char room code
2. Viewer emits `viewer-join` with the same code
3. Server notifies camera → camera creates WebRTC offer → sends via signaling
4. Viewer receives offer → creates answer → sends via signaling
5. ICE candidates exchanged → direct P2P WebRTC connection established
6. Server is no longer in the media path

### WebRTC topology

**Mesh** — camera creates one `RTCPeerConnection` per viewer. Simple, zero server bandwidth cost, ideal for 1–3 viewers. For 5+ viewers, consider migrating to an SFU (Mediasoup, LiveKit).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 + TypeScript + React 19 |
| Styling | TailwindCSS 3 |
| Realtime signaling | Socket.IO 4 |
| Media streaming | WebRTC (browser native) |
| Server | Express + custom Next.js server |
| PWA | Web App Manifest + Service Worker |
| Deployment | Railway (Node.js), Docker |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── camera/page.tsx     # Baby camera page
│   ├── viewer/
│   │   ├── join/page.tsx   # Room code entry
│   │   └── [roomCode]/     # Live viewer
├── components/
│   ├── camera/             # Camera-specific components
│   ├── viewer/             # Viewer-specific components
│   ├── shared/             # IOSWarning, ConnectionIndicator
│   └── ui/                 # Button, Slider
├── hooks/
│   ├── useWebRTC.ts        # Camera + viewer WebRTC logic
│   ├── useMediaStream.ts   # getUserMedia + camera switching
│   ├── useAudioDetection.ts # Web Audio API sound detection
│   ├── useWakeLock.ts      # Screen wake lock
│   └── useBattery.ts       # Battery Status API
├── lib/                    # Constants, socket singleton, utilities
├── server/                 # Socket.IO signaling server
└── types/                  # TypeScript type definitions
```

---

## Security & Privacy

- **No video storage**: media streams only between browser clients via WebRTC
- **Temporary sessions**: rooms expire after 30 minutes; cleaned up on disconnect
- **Rate limiting**: 10 Socket.IO events/second per connection
- **No auth required** for MVP — room codes provide lightweight access control
- **CORS restriction**: set `CORS_ORIGIN` to your domain in production

### Future hardening

- Add room PIN / password for extra security
- Implement TURN credentials rotation (time-limited tokens)
- Add end-to-end encryption via `RTCPeerConnection` Insertable Streams
- Persistent sessions with Redis for multi-instance deployments

---

## Future Extensions

- **White noise player** on the camera device
- **Temperature sensor** integration (BLE thermometer via Web Bluetooth)
- **Two-way audio** (intercom mode)
- **Motion detection** via canvas frame diff
- **Push notifications** when sound detected (iOS 16.4+ PWA)
- **SFU migration** (LiveKit / Mediasoup) for 5+ concurrent viewers
- **Recording** with `MediaRecorder` API (viewer-side, with consent)
