'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSocket } from '@/hooks/useSocket'
import { useViewerWebRTC } from '@/hooks/useWebRTC'
import { SOCKET_EVENTS } from '@/lib/constants'
import type { ViewerPageState, AudioDetectionState } from '@/types'
import VideoStream from './VideoStream'
import ConnectionStatus from './ConnectionStatus'
import BatteryStatus from './BatteryStatus'
import ConnectionIndicator from '@/components/shared/ConnectionIndicator'

interface Props {
  roomCode: string
}

export default function ViewerView({ roomCode }: Props) {
  const [pageState, setPageState] = useState<ViewerPageState>('connecting')
  const [cameraSocketId, setCameraSocketId] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(true)
  const [showControls, setShowControls] = useState(true)
  const [cameraBattery, setCameraBattery] = useState<{ level: number; charging: boolean } | null>(null)
  const [soundAlert, setSoundAlert] = useState(false)
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const soundAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  const { socket, status: socketStatus } = useSocket()
  const { remoteStream, connectionState, error, videoRef } = useViewerWebRTC(
    socket,
    cameraSocketId
  )

  // Auto-hide controls overlay after 3s of inactivity
  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000)
  }, [])

  const handleTap = useCallback(() => {
    // First tap unmutes; subsequent taps toggle controls
    if (isMuted) {
      setIsMuted(false)
      // Must also set the DOM property directly — React's muted prop doesn't always
      // propagate to the media element after initial render on all browsers
      if (videoRef.current) videoRef.current.muted = false
    }
    resetControlsTimer()
  }, [isMuted, resetControlsTimer, videoRef])

  // Join the room when socket connects
  useEffect(() => {
    if (!socket || socketStatus !== 'connected') return

    socket.emit(SOCKET_EVENTS.VIEWER_JOIN, { roomCode })

    const onRoomJoined = ({ cameraSocketId: camId }: { cameraSocketId?: string }) => {
      if (camId) {
        setCameraSocketId(camId)
        setPageState('waiting-for-camera')
      }
    }

    const onRoomError = ({ message }: { message: string }) => {
      console.error('[Room]', message)
      setPageState('error')
    }

    const onCameraDisconnected = () => {
      setPageState('disconnected')
    }

    const onAudioActivity = ({ isActive }: AudioDetectionState) => {
      if (isActive) {
        setSoundAlert(true)
        if (soundAlertTimerRef.current) clearTimeout(soundAlertTimerRef.current)
        soundAlertTimerRef.current = setTimeout(() => setSoundAlert(false), 3000)
      }
    }

    const onBatteryUpdate = (payload: { level: number; charging: boolean }) => {
      setCameraBattery({
        level: Math.round(payload.level * 100),
        charging: payload.charging,
      })
    }

    socket.on(SOCKET_EVENTS.ROOM_JOINED, onRoomJoined)
    socket.on(SOCKET_EVENTS.ROOM_ERROR, onRoomError)
    socket.on(SOCKET_EVENTS.CAMERA_DISCONNECTED, onCameraDisconnected)
    socket.on(SOCKET_EVENTS.AUDIO_ACTIVITY_RECEIVED, onAudioActivity)
    socket.on(SOCKET_EVENTS.BATTERY_UPDATE_RECEIVED, onBatteryUpdate)

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_JOINED, onRoomJoined)
      socket.off(SOCKET_EVENTS.ROOM_ERROR, onRoomError)
      socket.off(SOCKET_EVENTS.CAMERA_DISCONNECTED, onCameraDisconnected)
      socket.off(SOCKET_EVENTS.AUDIO_ACTIVITY_RECEIVED, onAudioActivity)
      socket.off(SOCKET_EVENTS.BATTERY_UPDATE_RECEIVED, onBatteryUpdate)
      if (soundAlertTimerRef.current) clearTimeout(soundAlertTimerRef.current)
    }
  }, [socket, socketStatus, roomCode])

  // Transition to streaming as soon as tracks arrive.
  // connectionState is unreliable on iOS Safari — ontrack firing is the ground truth.
  useEffect(() => {
    if (remoteStream) setPageState('streaming')
  }, [remoteStream])

  // Set srcObject after React renders the video element.
  // videoRef.current is null when ontrack fires (video not yet in DOM),
  // so we must set it here, after the render triggered by setRemoteStream.
  useEffect(() => {
    if (!remoteStream || !videoRef.current) return
    videoRef.current.srcObject = remoteStream
  }, [remoteStream, videoRef])

  useEffect(() => {
    if (connectionState === 'failed') setPageState('disconnected')
  }, [connectionState])

  // Start controls auto-hide timer on mount
  useEffect(() => {
    resetControlsTimer()
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    }
  }, [resetControlsTimer])

  const handleReconnect = () => {
    router.push('/viewer/join')
  }

  const isStreaming = pageState === 'streaming' && !!remoteStream

  return (
    <div className="relative h-full bg-black overflow-hidden" onClick={handleTap}>
      {/* Video — fills entire screen */}
      {(isStreaming || remoteStream) && (
        <VideoStream videoRef={videoRef} isMuted={isMuted} onTap={handleTap} />
      )}

      {/* Non-streaming state UI */}
      {!isStreaming && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background">
          <ConnectionStatus
            state={pageState}
            error={error}
            onReconnect={handleReconnect}
          />
          <p className="text-gray-600 text-sm mt-4">
            Room: <span className="font-mono font-bold text-gray-400">{roomCode}</span>
          </p>
        </div>
      )}

      {/* ── Sound alert toast ──────────────────────────────────────────── */}
      {soundAlert && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 z-50
                     bg-danger text-white rounded-xl px-5 py-3
                     text-sm font-bold shadow-lg animate-bounce pointer-events-none"
        >
          🔊 Baby is making noise!
        </div>
      )}

      {/* ── Controls overlay (auto-hides) ─────────────────────────────── */}
      {showControls && (
        <>
          {/* Top bar */}
          <div
            className="absolute inset-x-0 top-0 z-40 pt-safe px-4 py-3
                       bg-gradient-to-b from-black/70 to-transparent"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href="/viewer/join"
                  className="text-gray-400 hover:text-white text-sm transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  ← Back
                </Link>
                <ConnectionIndicator state={connectionState} />
              </div>

              <div className="flex items-center gap-3">
                {cameraBattery && (
                  <BatteryStatus
                    level={cameraBattery.level}
                    charging={cameraBattery.charging}
                  />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const next = !isMuted
                    setIsMuted(next)
                    if (videoRef.current) videoRef.current.muted = next
                    resetControlsTimer()
                  }}
                  className="text-white bg-black/50 rounded-full w-9 h-9 flex items-center justify-center text-lg"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? '🔇' : '🔊'}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          {isStreaming && (
            <div
              className="absolute inset-x-0 bottom-0 z-40 pb-safe px-4 py-3
                         bg-gradient-to-t from-black/70 to-transparent"
            >
              <div className="flex items-center justify-between">
                <div className="text-gray-400 text-xs">
                  <span className="font-mono font-bold text-gray-300">{roomCode}</span>
                </div>
                <p className="text-gray-500 text-xs">Tap screen to show/hide controls</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
