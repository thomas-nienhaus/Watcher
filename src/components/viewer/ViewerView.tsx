'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Volume2, VolumeX, Moon, Sun, MicOff } from 'lucide-react'
import { useSocket } from '@/hooks/useSocket'
import { useViewerWebRTC } from '@/hooks/useWebRTC'
import { SOCKET_EVENTS } from '@/lib/constants'
import type { ViewerPageState, AudioDetectionState } from '@/types'
import VideoStream from './VideoStream'
import ConnectionStatus from './ConnectionStatus'
import NightModeOverlay from '@/components/shared/NightModeOverlay'
import GlassPanel from '@/components/ui/GlassPanel'
import BatteryBadge from '@/components/ui/BatteryBadge'
import ConnectionBadge from '@/components/ui/ConnectionBadge'
import AudioPulse from '@/components/ui/AudioPulse'

interface Props {
  roomCode: string
}

export default function ViewerView({ roomCode }: Props) {
  const [pageState, setPageState] = useState<ViewerPageState>('connecting')
  const [cameraSocketId, setCameraSocketId] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(true)
  const [isNightMode, setIsNightMode] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [cameraBattery, setCameraBattery] = useState<{ level: number; charging: boolean } | null>(null)
  const [soundAlert, setSoundAlert] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [cameraSettings, setCameraSettings] = useState<{ isMicMuted: boolean; isNightMode: boolean } | null>(null)
  const [volume, setVolume] = useState(2)
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const soundAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const joinedSocketIdRef = useRef<string | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const router = useRouter()

  const { socket, status: socketStatus } = useSocket()
  const { remoteStream, connectionState, error, videoRef } = useViewerWebRTC(
    socket,
    cameraSocketId
  )

  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000)
  }, [])

  const initAudioBoost = useCallback(() => {
    if (!videoRef.current || gainNodeRef.current) return
    try {
      const ctx = new AudioContext()
      const source = ctx.createMediaElementSource(videoRef.current)
      const gain = ctx.createGain()
      gain.gain.value = volume
      source.connect(gain)
      gain.connect(ctx.destination)
      audioCtxRef.current = ctx
      gainNodeRef.current = gain
      if (ctx.state === 'suspended') ctx.resume()
    } catch {
      // Fallback: rely on native video volume only
    }
  }, [videoRef, volume])

  // Sync gain value with volume slider
  useEffect(() => {
    if (gainNodeRef.current) gainNodeRef.current.gain.value = volume
  }, [volume])

  const handleTap = useCallback(() => {
    if (isMuted) {
      setIsMuted(false)
      if (videoRef.current) videoRef.current.muted = false
      initAudioBoost()
    }
    resetControlsTimer()
  }, [isMuted, resetControlsTimer, videoRef, initAudioBoost])

  // Join room — guard prevents double-join on iOS Safari re-renders
  useEffect(() => {
    if (!socket || socketStatus !== 'connected') return
    if (joinedSocketIdRef.current === socket.id) return
    joinedSocketIdRef.current = socket.id ?? null

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

    const onAudioActivity = ({ isActive, level }: AudioDetectionState) => {
      setAudioLevel(level)
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

    const onCameraSettings = (payload: { isMicMuted: boolean; isNightMode: boolean }) => {
      setCameraSettings(payload)
    }

    socket.on(SOCKET_EVENTS.ROOM_JOINED, onRoomJoined)
    socket.on(SOCKET_EVENTS.ROOM_ERROR, onRoomError)
    socket.on(SOCKET_EVENTS.CAMERA_DISCONNECTED, onCameraDisconnected)
    socket.on(SOCKET_EVENTS.AUDIO_ACTIVITY_RECEIVED, onAudioActivity)
    socket.on(SOCKET_EVENTS.BATTERY_UPDATE_RECEIVED, onBatteryUpdate)
    socket.on(SOCKET_EVENTS.CAMERA_SETTINGS_RECEIVED, onCameraSettings)

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_JOINED, onRoomJoined)
      socket.off(SOCKET_EVENTS.ROOM_ERROR, onRoomError)
      socket.off(SOCKET_EVENTS.CAMERA_DISCONNECTED, onCameraDisconnected)
      socket.off(SOCKET_EVENTS.AUDIO_ACTIVITY_RECEIVED, onAudioActivity)
      socket.off(SOCKET_EVENTS.BATTERY_UPDATE_RECEIVED, onBatteryUpdate)
      socket.off(SOCKET_EVENTS.CAMERA_SETTINGS_RECEIVED, onCameraSettings)
      if (soundAlertTimerRef.current) clearTimeout(soundAlertTimerRef.current)
    }
  }, [socket, socketStatus, roomCode])

  // Transition to streaming as soon as tracks arrive
  useEffect(() => {
    if (remoteStream) setPageState('streaming')
  }, [remoteStream])

  // Set srcObject after React renders the video element
  useEffect(() => {
    if (!remoteStream || !videoRef.current) return
    videoRef.current.srcObject = remoteStream
  }, [remoteStream, videoRef])

  useEffect(() => {
    if (connectionState === 'failed') setPageState('disconnected')
  }, [connectionState])

  useEffect(() => {
    resetControlsTimer()
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current)
    }
  }, [resetControlsTimer])

  const isStreaming = pageState === 'streaming' && !!remoteStream

  return (
    <div className="relative h-full bg-black overflow-hidden" onClick={handleTap}>
      <NightModeOverlay active={isNightMode} />

      {/* Video */}
      {(isStreaming || remoteStream) && (
        <VideoStream videoRef={videoRef} isMuted={isMuted} onTap={handleTap} />
      )}

      {/* Non-streaming state */}
      {!isStreaming && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-0">
          <Link
            href="/viewer/join"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-0 left-0 pt-safe px-5 py-4 flex items-center gap-1.5 text-white/35 hover:text-white/60 text-sm transition-colors"
          >
            <ArrowLeft size={14} />
          </Link>
          <ConnectionStatus
            state={pageState}
            error={error}
            onReconnect={() => router.push('/viewer/join')}
          />
          <p className="text-white/20 text-xs mt-2 font-mono">{roomCode}</p>
        </div>
      )}

      {/* Sound alert toast */}
      <AnimatePresence>
        {soundAlert && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="absolute top-20 inset-x-0 z-50 flex justify-center px-6 pointer-events-none"
          >
            <GlassPanel className="px-5 py-3 flex items-center gap-3">
              <AudioPulse level={audioLevel} isActive nightMode={isNightMode} size="sm" />
              <span className="text-white/80 text-sm font-medium">Geluid gedetecteerd</span>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Streaming overlays */}
      {isStreaming && (
        <AnimatePresence>
          {showControls && (
            <>
              {/* Top bar */}
              <motion.div
                key="top"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-x-0 top-0 z-40 pt-safe px-4 py-3
                           bg-gradient-to-b from-black/70 to-transparent pointer-events-none"
              >
                <div className="flex items-center justify-between pointer-events-auto">
                  <Link
                    href="/viewer/join"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 -ml-2 text-white/50 hover:text-white transition-colors"
                    aria-label="Terug"
                  >
                    <ArrowLeft size={18} strokeWidth={1.5} />
                  </Link>

                  <div className="flex items-center gap-3">
                    <ConnectionBadge state={connectionState} />
                    {cameraBattery && (
                      <BatteryBadge
                        level={cameraBattery.level}
                        charging={cameraBattery.charging}
                      />
                    )}
                    {cameraSettings?.isMicMuted && (
                      <div className="flex items-center gap-1 text-white/40" title="Microfoon gedempt">
                        <MicOff size={13} strokeWidth={1.5} />
                      </div>
                    )}
                    {cameraSettings?.isNightMode && (
                      <div className="flex items-center gap-1 text-white/40" title="Nachtmodus aan">
                        <Moon size={13} strokeWidth={1.5} />
                      </div>
                    )}
                    <AudioPulse level={audioLevel} isActive={soundAlert} nightMode={isNightMode} size="sm" />
                  </div>
                </div>
              </motion.div>

              {/* Bottom bar */}
              <motion.div
                key="bottom"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-x-0 bottom-0 z-40 pb-safe px-4 py-4
                           bg-gradient-to-t from-black/70 to-transparent"
                onClick={(e) => e.stopPropagation()}
              >
                <GlassPanel className="px-4 py-3 flex flex-col gap-3">
                  <AudioPulse level={audioLevel} isActive={soundAlert} nightMode={isNightMode} />

                  {/* Volume slider — only shown when unmuted */}
                  {!isMuted && (
                    <div className="flex items-center gap-2.5 px-1">
                      <VolumeX size={12} strokeWidth={1.5} className="text-white/25 shrink-0" />
                      <input
                        type="range"
                        min={1}
                        max={4}
                        step={0.1}
                        value={volume}
                        onChange={(e) => { setVolume(parseFloat(e.target.value)); resetControlsTimer() }}
                        className="flex-1 h-1 rounded-full accent-accent-blue cursor-pointer"
                        aria-label="Volume versterking"
                      />
                      <Volume2 size={12} strokeWidth={1.5} className="text-white/25 shrink-0" />
                      <span className="text-white/30 text-xs w-8 text-right tabular-nums">
                        {Math.round(volume * 100)}%
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconBtn
                        icon={isMuted ? VolumeX : Volume2}
                        label={isMuted ? 'Geluid aan' : 'Geluid uit'}
                        active={!isMuted}
                        onPress={() => {
                          const next = !isMuted
                          setIsMuted(next)
                          if (next) {
                            if (gainNodeRef.current) gainNodeRef.current.gain.value = 0
                          } else {
                            if (videoRef.current) videoRef.current.muted = false
                            initAudioBoost()
                            if (gainNodeRef.current) gainNodeRef.current.gain.value = volume
                            if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume()
                          }
                          resetControlsTimer()
                        }}
                      />
                      <IconBtn
                        icon={isNightMode ? Sun : Moon}
                        label={isNightMode ? 'Nachtmodus uit' : 'Nachtmodus aan'}
                        active={isNightMode}
                        onPress={() => {
                          setIsNightMode((v) => !v)
                          resetControlsTimer()
                        }}
                      />
                    </div>
                    <span className="text-white/20 text-xs font-mono">{roomCode}</span>
                  </div>
                </GlassPanel>
              </motion.div>
            </>
          )}
        </AnimatePresence>
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
      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90
        ${active
          ? 'bg-accent-blue/20 border border-accent-blue/30 text-accent-blue'
          : 'bg-white/5 border border-white/8 text-white/50 hover:text-white'
        }`}
    >
      <Icon size={16} strokeWidth={1.5} />
    </button>
  )
}
