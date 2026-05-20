'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { SOCKET_EVENTS } from '@/lib/constants'
import type { SleepSoundType } from '@/types'

// ── Noise generators ─────────────────────────────────────────────────────────

function buildWhiteNoise(ctx: AudioContext): AudioBufferSourceNode {
  const len = ctx.sampleRate * 2
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  return src
}

function buildPinkNoise(ctx: AudioContext): AudioBufferSourceNode {
  // Paul Kellet's pink noise approximation
  const len = ctx.sampleRate * 2
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.96900 * b2 + w * 0.1538520
    b3 = 0.86650 * b3 + w * 0.3104856
    b4 = 0.55000 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.0168980
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) / 7
    b6 = w * 0.115926
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  return src
}

function buildBrownNoise(ctx: AudioContext): AudioBufferSourceNode {
  const len = ctx.sampleRate * 2
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let prev = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    prev = (prev + 0.02 * w) / 1.02
    data[i] = prev * 3.5
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  return src
}

function buildRain(ctx: AudioContext, dest: AudioNode): () => void {
  // Brown noise base filtered at 1 kHz to mimic rain
  const brown = buildBrownNoise(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1000
  filter.Q.value = 0.3
  brown.connect(filter)
  filter.connect(dest)
  brown.start()
  return () => { try { brown.stop() } catch { /* already stopped */ } }
}

function buildLullaby(ctx: AudioContext, dest: AudioNode): () => void {
  // "Twinkle Twinkle" (public domain) — C major, 0.55 s per note
  const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00, A4 = 440.00
  const seq = [C4, C4, G4, G4, A4, A4, G4, 0, F4, F4, E4, E4, D4, D4, C4, 0]
  const noteSec = 0.55
  const loopSec = seq.length * noteSec

  let cancelled = false
  const oscs: OscillatorNode[] = []

  function scheduleLoop(startAt: number) {
    if (cancelled) return
    seq.forEach((freq, i) => {
      if (!freq) return
      const osc = ctx.createOscillator()
      const env = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = startAt + i * noteSec
      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(0.4, t + 0.04)
      env.gain.linearRampToValueAtTime(0.25, t + noteSec * 0.75)
      env.gain.linearRampToValueAtTime(0, t + noteSec * 0.95)
      osc.connect(env)
      env.connect(dest)
      osc.start(t)
      osc.stop(t + noteSec)
      oscs.push(osc)
    })
    // Schedule next iteration ~1 s before this one ends
    const delay = Math.max(0, (startAt + loopSec - 1 - ctx.currentTime) * 1000)
    setTimeout(() => scheduleLoop(startAt + loopSec), delay)
  }

  scheduleLoop(ctx.currentTime)

  return () => {
    cancelled = true
    oscs.forEach((o) => { try { o.stop() } catch { /* already stopped */ } })
    oscs.length = 0
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSleepSound(socket: Socket | null, socketStatus: string) {
  const [sound, setSound] = useState<SleepSoundType>('off')
  const [volume, setVolume] = useState(0.5)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const stopCurrentRef = useRef<(() => void) | null>(null)

  // Keep refs in sync so socket callbacks don't capture stale values
  const soundRef = useRef<SleepSoundType>('off')
  soundRef.current = sound
  const volumeRef = useRef(0.5)
  volumeRef.current = volume

  // Called from the camera "Start" button handler — creates AudioContext inside user gesture
  const initSleepAudio = useCallback(() => {
    if (audioCtxRef.current) return
    const ctx = new AudioContext()
    const master = ctx.createGain()
    master.gain.value = volumeRef.current
    master.connect(ctx.destination)
    audioCtxRef.current = ctx
    masterGainRef.current = master
    // Immediately suspend to use zero CPU when idle
    ctx.suspend()
  }, [])

  const activateSound = useCallback((s: SleepSoundType, vol: number) => {
    const ctx = audioCtxRef.current
    const master = masterGainRef.current
    if (!ctx || !master) return

    // Stop whatever is playing
    if (stopCurrentRef.current) {
      stopCurrentRef.current()
      stopCurrentRef.current = null
    }

    master.gain.value = vol

    if (s === 'off') {
      ctx.suspend()
      return
    }

    ctx.resume()

    switch (s) {
      case 'white': {
        const src = buildWhiteNoise(ctx)
        src.connect(master)
        src.start()
        stopCurrentRef.current = () => { try { src.stop() } catch { /* already stopped */ } }
        break
      }
      case 'pink': {
        const src = buildPinkNoise(ctx)
        src.connect(master)
        src.start()
        stopCurrentRef.current = () => { try { src.stop() } catch { /* already stopped */ } }
        break
      }
      case 'brown': {
        const src = buildBrownNoise(ctx)
        src.connect(master)
        src.start()
        stopCurrentRef.current = () => { try { src.stop() } catch { /* already stopped */ } }
        break
      }
      case 'rain': {
        stopCurrentRef.current = buildRain(ctx, master)
        break
      }
      case 'lullaby': {
        stopCurrentRef.current = buildLullaby(ctx, master)
        break
      }
    }
  }, [])

  // Local control (camera operator)
  const setSoundLocal = useCallback((s: SleepSoundType) => {
    setSound(s)
    activateSound(s, volumeRef.current)
    socket?.emit(SOCKET_EVENTS.SLEEP_SOUND_STATE, { sound: s, volume: volumeRef.current })
  }, [socket, activateSound])

  const setVolumeLocal = useCallback((v: number) => {
    setVolume(v)
    if (masterGainRef.current) masterGainRef.current.gain.value = v
    socket?.emit(SOCKET_EVENTS.SLEEP_SOUND_STATE, { sound: soundRef.current, volume: v })
  }, [socket])

  // Receive commands from viewers
  useEffect(() => {
    if (!socket || socketStatus !== 'connected') return
    const onCommand = ({ sound: s, volume: v }: { sound: SleepSoundType; volume: number }) => {
      setSound(s)
      setVolume(v)
      activateSound(s, v)
      // Re-broadcast state so all viewers stay in sync
      socket.emit(SOCKET_EVENTS.SLEEP_SOUND_STATE, { sound: s, volume: v })
    }
    socket.on(SOCKET_EVENTS.SLEEP_SOUND_COMMAND, onCommand)
    return () => { socket.off(SOCKET_EVENTS.SLEEP_SOUND_COMMAND, onCommand) }
  }, [socket, socketStatus, activateSound])

  // Sync state to newly-joined viewers
  useEffect(() => {
    if (!socket || socketStatus !== 'connected') return
    const onViewerJoined = () => {
      socket.emit(SOCKET_EVENTS.SLEEP_SOUND_STATE, { sound: soundRef.current, volume: volumeRef.current })
    }
    socket.on(SOCKET_EVENTS.VIEWER_JOINED, onViewerJoined)
    return () => { socket.off(SOCKET_EVENTS.VIEWER_JOINED, onViewerJoined) }
  }, [socket, socketStatus])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stopCurrentRef.current) stopCurrentRef.current()
      audioCtxRef.current?.close()
    }
  }, [])

  return {
    sound,
    volume,
    isPlaying: sound !== 'off',
    initSleepAudio,
    setSound: setSoundLocal,
    setVolume: setVolumeLocal,
  }
}
