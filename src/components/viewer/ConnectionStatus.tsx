'use client'

import Button from '@/components/ui/Button'
import type { ViewerPageState } from '@/types'

interface Props {
  state: ViewerPageState
  error: string | null
  onReconnect: () => void
}

export default function ConnectionStatus({ state, error, onReconnect }: Props) {
  return (
    <div className="flex flex-col items-center gap-6 p-8 text-center max-w-xs">
      {state === 'connecting' && (
        <>
          <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="text-white font-semibold text-lg">Connecting…</p>
            <p className="text-gray-400 text-sm mt-1">Reaching the signaling server</p>
          </div>
        </>
      )}

      {state === 'waiting-for-camera' && (
        <>
          <div className="w-14 h-14 border-4 border-warning border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="text-white font-semibold text-lg">Waiting for camera…</p>
            <p className="text-gray-400 text-sm mt-1">
              Make sure the camera device has started streaming
            </p>
          </div>
        </>
      )}

      {(state === 'disconnected' || state === 'error') && (
        <>
          <div className="text-5xl">📵</div>
          <div>
            <p className="text-white font-semibold text-lg">Camera offline</p>
            {error && <p className="text-gray-400 text-sm mt-1">{error}</p>}
          </div>
          <Button onClick={onReconnect} size="lg" className="w-full">
            🔄 Reconnect
          </Button>
        </>
      )}
    </div>
  )
}
