'use client'

interface Props {
  state: RTCPeerConnectionState | 'idle' | 'waiting' | 'connecting'
}

const STYLES: Record<string, { dot: string; label: string }> = {
  connected:    { dot: 'bg-primary',                label: 'Connected' },
  connecting:   { dot: 'bg-warning animate-pulse',  label: 'Connecting…' },
  new:          { dot: 'bg-warning animate-pulse',  label: 'Initializing…' },
  checking:     { dot: 'bg-warning animate-pulse',  label: 'Checking ICE…' },
  disconnected: { dot: 'bg-gray-500',               label: 'Disconnected' },
  failed:       { dot: 'bg-danger',                 label: 'Failed' },
  closed:       { dot: 'bg-gray-600',               label: 'Closed' },
  idle:         { dot: 'bg-gray-600',               label: 'Idle' },
  waiting:      { dot: 'bg-yellow-500 animate-pulse', label: 'Waiting for camera…' },
}

export default function ConnectionIndicator({ state }: Props) {
  const { dot, label } = STYLES[state] ?? { dot: 'bg-gray-500', label: state }

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
      <span className="text-sm text-gray-300 font-medium">{label}</span>
    </div>
  )
}
