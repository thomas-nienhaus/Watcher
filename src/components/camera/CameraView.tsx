'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { generateRoomCode } from '@/lib/roomCode'
import { useSocket } from '@/hooks/useSocket'
import { useCameraWebRTC } from '@/hooks/useWebRTC'
import { useMediaStream } from '@/hooks/useMediaStream'
import { useAudioDetection } from '@/hooks/useAudioDetection'
import { useWakeLock } from '@/hooks/useWakeLock'
import { useBattery } from '@/hooks/useBattery'
import { SOCKET_EVENTS, AUDIO_DETECTION } from '@/lib/constants'
import type { CameraPageState, AudioDetectionState } from '@/types'
import VideoPreview from './VideoPreview'
import AudioMeter from './AudioMeter'
import CameraControls from './CameraControls'
import IOSWarning from '@/components/shared/IOSWarning'
import ConnectionIndicator from '@/components/shared/ConnectionIndicator'
import Button from '@/components/ui/Button'

// Room code is stable for the lifetime of this component (once per mount)
const ROOM_CODE = generateRoomCode()

export default function CameraView() {
  const [pageState, setPageState] = useState<CameraPageState>('idle')
  const [isNightMode, setIsNightMode] = useState(false)
  const [audioThreshold, setAudioThreshold] = useState<number>(AUDIO_DETECTION.DEFAULT_THRESHOLD)
  const [showQR, setShowQR] = useState(true)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const qrGeneratedRef = useRef(false)

  // Generate QR code data URL once the component mounts (client-only)
  useEffect(() => {
    if (qrGeneratedRef.current) return
    qrGeneratedRef.current = true
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/viewer/${ROOM_CODE}`
        : `/viewer/${ROOM_CODE}`
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(url, { width: 200, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
        .then(setQrDataUrl)
    })
  }, [])

  const { socket, status: socketStatus } = useSocket()
  const { stream, error: streamError, startStream, flipCamera, stopStream } = useMediaStream()
  const { viewerCount, connectionStates } = useCameraWebRTC(socket, stream)
  const { enable: enableWakeLock, disable: disableWakeLock, isLocked } = useWakeLock()
  const battery = useBattery()

  const onAudioActivity = useCallback(
    (payload: AudioDetectionState) => {
      socket?.emit(SOCKET_EVENTS.AUDIO_ACTIVITY, payload)
    },
    [socket]
  )

  const { level: audioLevel, isActive: audioIsActive, initAudioContext } =
    useAudioDetection(stream, audioThreshold, onAudioActivity)

  // Send battery status to viewers whenever it changes
  useEffect(() => {
    if (!socket || !battery.isSupported || battery.level === null) return
    socket.emit(SOCKET_EVENTS.BATTERY_UPDATE, {
      level: battery.level / 100,
      charging: battery.charging ?? false,
    })
  }, [socket, battery.level, battery.charging, battery.isSupported])

  // Register this device as the room camera when socket connects
  useEffect(() => {
    if (!socket || socketStatus !== 'connected') return

    socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomCode: ROOM_CODE })

    const onRoomError = ({ message }: { message: string }) => {
      console.error('[Room]', message)
    }
    socket.on(SOCKET_EVENTS.ROOM_ERROR, onRoomError)
    return () => { socket.off(SOCKET_EVENTS.ROOM_ERROR, onRoomError) }
  }, [socket, socketStatus])

  const handleStart = async () => {
    setPageState('requesting-permission')
    await startStream('environment')

    // initAudioContext MUST be called synchronously inside this user gesture handler.
    // iOS Safari will refuse to create AudioContext outside of a direct user gesture.
    initAudioContext()

    await enableWakeLock()
    setPageState('streaming')
  }

  const handleStop = useCallback(() => {
    stopStream()
    disableWakeLock()
    setPageState('idle')
  }, [stopStream, disableWakeLock])

  // Derive overall connection state for the indicator
  const viewerIds = Array.from(connectionStates.keys())
  const overallState: RTCPeerConnectionState | 'idle' =
    viewerIds.length > 0 ? (connectionStates.get(viewerIds[0]) ?? 'idle') : 'idle'

  return (
    <div
      className={`relative h-full flex flex-col bg-background ${
        isNightMode ? 'night-mode' : ''
      }`}
    >
      <IOSWarning />

      {/* Full-screen video preview when streaming */}
      {stream && (
        <div className="absolute inset-0">
          <VideoPreview stream={stream} />
          {/* Gradient overlays so controls remain readable over video */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 pointer-events-none" />
        </div>
      )}

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-safe py-3">
        <Link
          href="/"
          className="text-gray-400 hover:text-white transition-colors text-sm"
          onClick={handleStop}
        >
          ← Home
        </Link>

        <div className="flex items-center gap-3 text-sm text-gray-300">
          {pageState === 'streaming' && (
            <>
              <ConnectionIndicator state={overallState} />
              <span title="Viewers connected">👤 {viewerCount}</span>
              {isLocked && <span title="Screen stay-awake active">🔆</span>}
              {battery.isSupported && battery.level !== null && (
                <span>
                  {battery.charging ? '⚡' : '🔋'} {battery.level}%
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 px-6">
        {/* Idle: show QR + room code + start button */}
        {pageState === 'idle' && !streamError && (
          <div className="flex flex-col items-center gap-6 w-full max-w-sm">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">Camera Setup</h1>
              <p className="text-gray-400 text-sm mt-1">Share this code with the viewer device</p>
            </div>

            {/* QR code toggle */}
            <button
              onClick={() => setShowQR((v) => !v)}
              className="bg-white p-3 rounded-2xl shadow-lg active:scale-95 transition-transform"
              aria-label={showQR ? 'Hide QR code' : 'Show QR code'}
            >
              {showQR && qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR code to connect viewer" width={180} height={180} />
              ) : (
                <div className="w-[180px] h-[180px] flex items-center justify-center text-gray-400 text-sm">
                  {showQR ? 'Generating…' : 'Tap to show QR'}
                </div>
              )}
            </button>

            <div className="text-center">
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">
                Room Code
              </p>
              <p className="text-5xl font-mono font-bold tracking-[0.2em] text-white">
                {ROOM_CODE}
              </p>
            </div>

            <Button size="lg" className="w-full text-xl" onClick={handleStart}>
              🎥 Start Camera
            </Button>
          </div>
        )}

        {/* Requesting permission spinner */}
        {pageState === 'requesting-permission' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-white font-semibold">Requesting camera access…</p>
            <p className="text-gray-400 text-sm">Tap Allow when prompted</p>
          </div>
        )}

        {/* Stream error */}
        {streamError && (
          <div className="bg-danger/10 border border-danger/50 rounded-2xl p-5 text-center w-full max-w-sm">
            <p className="text-2xl mb-2">🚫</p>
            <p className="text-danger font-semibold">Camera Error</p>
            <p className="text-gray-300 text-sm mt-2 leading-relaxed">{streamError}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => setPageState('idle')}
            >
              Try Again
            </Button>
          </div>
        )}
      </div>

      {/* ── Bottom controls — only while streaming ─────────────────────── */}
      {pageState === 'streaming' && stream && (
        <div className="relative z-10 flex flex-col gap-3 px-4 pb-safe py-3">
          {/* Audio level meter */}
          <div className="bg-black/40 rounded-xl p-3">
            <AudioMeter level={audioLevel} isActive={audioIsActive} />
          </div>

          {/* Camera controls */}
          <div className="bg-black/40 rounded-xl p-3">
            <CameraControls
              onFlip={flipCamera}
              onToggleNightMode={() => setIsNightMode((n) => !n)}
              isNightMode={isNightMode}
              audioThreshold={audioThreshold}
              onThresholdChange={setAudioThreshold}
            />
          </div>

          {/* Room code reminder + stop */}
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-gray-500 text-xs">Room code</p>
              <p className="text-white font-mono font-bold tracking-widest text-lg">
                {ROOM_CODE}
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={handleStop}>
              Stop
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
