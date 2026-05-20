'use client'

import { Wifi, WifiOff, Loader2 } from 'lucide-react'

interface Props {
  state: RTCPeerConnectionState | 'idle'
}

export default function ConnectionBadge({ state }: Props) {
  if (state === 'connected') {
    return (
      <div className="flex items-center gap-1.5 text-accent-sage">
        <Wifi size={13} strokeWidth={1.5} />
        <span className="text-xs font-medium">Verbonden</span>
      </div>
    )
  }
  if (state === 'connecting') {
    return (
      <div className="flex items-center gap-1.5 text-warning">
        <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
        <span className="text-xs font-medium">Verbinden…</span>
      </div>
    )
  }
  if (state === 'failed' || state === 'disconnected') {
    return (
      <div className="flex items-center gap-1.5 text-live/80">
        <WifiOff size={13} strokeWidth={1.5} />
        <span className="text-xs font-medium">Verbroken</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5 text-white/30">
      <Wifi size={13} strokeWidth={1.5} />
      <span className="text-xs font-medium">Wachten</span>
    </div>
  )
}
