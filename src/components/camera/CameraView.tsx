'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, FlipHorizontal, Mic, MicOff, Moon, Sun, StopCircle, Users } from 'lucide-react'
import { generateRoomCode } from '@/lib/roomCode'
import { useSocket } from '@/hooks/useSocket'
import { useCameraWebRTC } from '@/hooks/useWebRTC'
import { useMediaStream } from '@/hooks/useMediaStream'
import { useAudioDetection } from '@/hooks/useAudioDetection'
import { useWakeLock } from '@/hooks/useWakeLock'
import { useBattery } from '@/hooks/useBattery'
import { useSleepSound } from '@/hooks/useSleepSound'
import { SOCKET_EVENTS, AUDIO_DETECTION } from '@/lib/constants'
import type { CameraPageState, AudioDetectionState } from '@/types'
import VideoPreview from './VideoPreview'
import SleepSoundPanel from './SleepSoundPanel'
import IOSWarning from '@/components/shared/IOSWarning'
import NightModeOverlay from '@/components/shared/NightModeOverlay'
import GlassPanel from '@/components/ui/GlassPanel'
import LiveIndicator from '@/components/ui/LiveIndicator'
import BatteryBadge from '@/components/ui/BatteryBadge'
import AudioPulse from '@/components/ui/AudioPulse'
import RoomCodeDisplay from '@/components/ui/RoomCodeDisplay'
import Button from '@/components/ui/Button'

const ROOM_CODE = generateRoomCode()

export default function CameraView() {
  const [pageState, setPageState] = useState<CameraPageState>('idle')
  const [isNightMode, setIsNightMode] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [audioThreshold, setAudioThreshold] = useState<number>(AUDIO_DETECTION.DEFAULT_THRESHOLD)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [micBlocked, setMicBlocked] = useState(false)
  const [showSheet, setShowSheet] = useState(true)
  const sheetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const qrGeneratedRef = useRef(false)
  const roomJoinedRef = useRef(false)

  useEffect(() => {
    return () => {
      if (sheetTimerRef.current) clearTimeout(sheetTimerRef.current)
    }
  }, [])

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
  const { stream, error: streamError, startStream, flipCamera, stopStream, streamRef } = useMediaStream()
  const { viewerCount, connectionStates } = useCameraWebRTC(socket, stream)
  const { enable: enableWakeLock, disable: disableWakeLock } = useWakeLock()
  const battery = useBattery()

  const onAudioActivity = useCallback(
    (payload: AudioDetectionState) => {
      socket?.emit(SOCKET_EVENTS.AUDIO_ACTIVITY, payload)
    },
    [socket]
  )

  const { level: audioLevel, isActive: audioIsActive, initAudioContext } =
    useAudioDetection(stream, audioThreshold, onAudioActivity)

  const { sound: sleepSound, volume: sleepVolume, initSleepAudio, setSound: setSleepSound, setVolume: setSleepVolume } =
    useSleepSound(socket, socketStatus)

  useEffect(() => {
    if (!socket || !battery.isSupported || battery.level === null) return
    socket.emit(SOCKET_EVENTS.BATTERY_UPDATE, {
      level: battery.level / 100,
      charging: battery.charging ?? false,
    })
  }, [socket, battery.level, battery.charging, battery.isSupported])

  useEffect(() => {
    if (!socket || socketStatus !== 'connected' || roomJoinedRef.current) return
    roomJoinedRef.current = true
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomCode: ROOM_CODE })
    const onRoomError = ({ message }: { message: string }) => {
      console.warn('[Room] Error, recreating room:', message)
      roomJoinedRef.current = false
      socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomCode: ROOM_CODE })
    }
    socket.on(SOCKET_EVENTS.ROOM_ERROR, onRoomError)
    return () => { socket.off(SOCKET_EVENTS.ROOM_ERROR, onRoomError) }
  }, [socket, socketStatus])

  useEffect(() => {
    if (socketStatus === 'disconnected') roomJoinedRef.current = false
  }, [socketStatus])

  // Emit camera settings to viewers on change and when a new viewer joins
  const isMicMutedRef = useRef(isMicMuted)
  isMicMutedRef.current = isMicMuted
  const isNightModeRef = useRef(isNightMode)
  isNightModeRef.current = isNightMode

  useEffect(() => {
    if (!socket || socketStatus !== 'connected') return
    socket.emit(SOCKET_EVENTS.CAMERA_SETTINGS, { isMicMuted, isNightMode })
  }, [socket, socketStatus, isMicMuted, isNightMode])

  useEffect(() => {
    if (!socket || socketStatus !== 'connected') return
    const onViewerJoined = () => {
      socket.emit(SOCKET_EVENTS.CAMERA_SETTINGS, {
        isMicMuted: isMicMutedRef.current,
        isNightMode: isNightModeRef.current,
      })
    }
    socket.on(SOCKET_EVENTS.VIEWER_JOINED, onViewerJoined)
    return () => { socket.off(SOCKET_EVENTS.VIEWER_JOINED, onViewerJoined) }
  }, [socket, socketStatus])

  const resetSheetTimer = useCallback(() => {
    setShowSheet(true)
    if (sheetTimerRef.current) clearTimeout(sheetTimerRef.current)
    sheetTimerRef.current = setTimeout(() => setShowSheet(false), 5000)
  }, [])

  const handleStart = async () => {
    setPageState('requesting-permission')
    await startStream('environment')
    if (!streamRef.current) {
      setPageState('idle')
      return
    }
    setMicBlocked(streamRef.current.getAudioTracks().length === 0)
    initAudioContext(streamRef.current)
    initSleepAudio()
    await enableWakeLock()
    setPageState('streaming')
    resetSheetTimer()
  }

  const handleStop = useCallback(() => {
    stopStream()
    disableWakeLock()
    setPageState('idle')
  }, [stopStream, disableWakeLock])

  const viewerIds = Array.from(connectionStates.keys())
  const overallState: RTCPeerConnectionState | 'idle' =
    viewerIds.length > 0 ? (connectionStates.get(viewerIds[0]) ?? 'idle') : 'idle'

  const isStreaming = pageState === 'streaming'

  return (
    <div
      className={`relative h-full bg-surface-0 overflow-hidden`}
      onClick={isStreaming ? resetSheetTimer : undefined}
    >
      <IOSWarning />
      <NightModeOverlay active={isNightMode} />

      {/* Full-screen video */}
      {stream && (
        <div className="absolute inset-0">
          <VideoPreview stream={stream} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70 pointer-events-none" />
        </div>
      )}

      {/* ── Idle / setup state ─────────────────────────────────────────── */}
      {!isStreaming && (
        <div className="relative z-10 flex flex-col h-full pt-safe pb-safe">
          {/* Top bar */}
          <div className="flex items-center px-5 py-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors"
            >
              <ArrowLeft size={14} />
              Home
            </Link>
          </div>

          {/* Center content */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
            {pageState === 'requesting-permission' ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="w-10 h-10 rounded-full border-2 border-accent-blue/40 border-t-accent-blue animate-spin" />
                <p className="text-white/60 text-sm">Camera openen…</p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                className="w-full max-w-sm"
              >
                <GlassPanel className="p-6 flex flex-col gap-6">
                  <div>
                    <h2 className="text-white font-semibold text-lg">Camera instellen</h2>
                    <p className="text-white/35 text-sm mt-1">Deel de code met het kijkende apparaat</p>
                  </div>

                  {/* QR code */}
                  <div className="flex justify-center">
                    <div className="bg-white p-3 rounded-2xl">
                      {qrDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={qrDataUrl} alt="QR code om kijker te verbinden" width={160} height={160} />
                      ) : (
                        <div className="w-[160px] h-[160px] flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <p className="text-white/25 text-xs uppercase tracking-widest">Kamercode</p>
                    <RoomCodeDisplay code={ROOM_CODE} size="lg" />
                  </div>

                  {streamError ? (
                    <div className="bg-live/10 border border-live/20 rounded-2xl p-4 text-center">
                      <p className="text-live/80 text-sm font-medium">Camera fout</p>
                      <p className="text-white/40 text-xs mt-1">{streamError}</p>
                    </div>
                  ) : (
                    <Button size="lg" className="w-full" onClick={handleStart}>
                      Camera starten
                    </Button>
                  )}
                </GlassPanel>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* ── Streaming state ────────────────────────────────────────────── */}
      {isStreaming && (
        <>
          {/* Top bar — always visible */}
          <div className="absolute inset-x-0 top-0 z-30 pt-safe px-5 py-4">
            <div className="flex items-center justify-between">
              <Link
                href="/"
                onClick={handleStop}
                className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors"
              >
                <ArrowLeft size={14} />
              </Link>
              <div className="flex items-center gap-4">
                <LiveIndicator />
                {battery.isSupported && battery.level !== null && (
                  <BatteryBadge level={battery.level} charging={battery.charging ?? false} />
                )}
                <div className="flex items-center gap-1.5 text-white/50">
                  <Users size={13} strokeWidth={1.5} />
                  <span className="text-xs">{viewerCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Microphone blocked warning */}
          <AnimatePresence>
            {micBlocked && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-20 inset-x-0 z-30 flex justify-center px-5"
              >
                <GlassPanel className="px-4 py-2.5">
                  <p className="text-warning text-xs text-center">
                    Microfoon geblokkeerd — Instellingen → Privacy → Microfoon → Safari
                  </p>
                </GlassPanel>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom sheet — auto-hides */}
          <AnimatePresence>
            {showSheet && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                className="absolute inset-x-0 bottom-0 z-30 pb-safe px-4 py-4"
              >
                <GlassPanel className="p-4 flex flex-col gap-4">
                  {/* Room code + status */}
                  <div className="flex items-center justify-between">
                    <RoomCodeDisplay code={ROOM_CODE} size="sm" />
                    <span className="text-white/30 text-xs">
                      {viewerCount === 0 ? 'Wachten op kijker…' : `${viewerCount} kijker${viewerCount > 1 ? 's' : ''}`}
                    </span>
                  </div>

                  {/* Audio pulse */}
                  <AudioPulse level={audioLevel} isActive={audioIsActive} nightMode={isNightMode} />

                  {/* Sleep sound controls */}
                  <SleepSoundPanel
                    sound={sleepSound}
                    volume={sleepVolume}
                    onSoundChange={setSleepSound}
                    onVolumeChange={setSleepVolume}
                  />

                  {/* Controls */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <IconBtn
                        icon={FlipHorizontal}
                        label="Camera omdraaien"
                        onPress={flipCamera}
                      />
                      <IconBtn
                        icon={isMicMuted ? MicOff : Mic}
                        label={isMicMuted ? 'Microfoon aan' : 'Microfoon uit'}
                        active={isMicMuted}
                        onPress={() => setIsMicMuted((v) => !v)}
                      />
                      <IconBtn
                        icon={isNightMode ? Sun : Moon}
                        label={isNightMode ? 'Nachtmodus uit' : 'Nachtmodus aan'}
                        active={isNightMode}
                        onPress={() => setIsNightMode((v) => !v)}
                      />
                    </div>
                    <button
                      onClick={handleStop}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-live/10 border border-live/20 text-live/80 text-xs font-medium active:scale-95 transition-all"
                      aria-label="Stop camera"
                    >
                      <StopCircle size={13} strokeWidth={1.5} />
                      Stop
                    </button>
                  </div>
                </GlassPanel>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

function IconBtn({
  icon: Icon,
  label,
  onPress,
  active = false,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  label: string
  onPress: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onPress}
      aria-label={label}
      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90
        ${active
          ? 'bg-accent-blue/20 border border-accent-blue/30 text-accent-blue'
          : 'bg-white/5 border border-white/8 text-white/60 hover:text-white'
        }`}
    >
      <Icon size={17} strokeWidth={1.5} />
    </button>
  )
}
