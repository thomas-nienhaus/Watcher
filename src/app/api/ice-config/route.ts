import { NextResponse } from 'next/server'

export function GET() {
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ]

  if (process.env.TURN_URL) {
    iceServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME ?? '',
      credential: process.env.TURN_CREDENTIAL ?? '',
    })
  }

  return NextResponse.json({ iceServers }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
