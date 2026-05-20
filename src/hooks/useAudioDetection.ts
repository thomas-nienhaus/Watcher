'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AUDIO_DETECTION } from '@/lib/constants'
import type { AudioDetectionState } from '@/types'

export function useAudioDetection(
  stream: MediaStream | null,
  threshold: number = AUDIO_DETECTION.DEFAULT_THRESHOLD,
  onActivity?: (payload: AudioDetectionState) => void
) {
  const [state, setState] = useState<AudioDetectionState>({ level: 0, isActive: false })
  const contextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)
  const sustainedStartRef = useRef<number | null>(null)
  const lastEmitRef = useRef<number>(0)
  // Use refs so the running RAF loop reads live values without re-creating callbacks
  const onActivityRef = useRef(onActivity)
  onActivityRef.current = onActivity
  const thresholdRef = useRef(threshold)
  thresholdRef.current = threshold

  const startAnalysis = useCallback(() => {
    if (!contextRef.current || !analyserRef.current) return

    const analyser = analyserRef.current
    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
      analyser.getByteFrequencyData(dataArray)

      // RMS over frequency bins — for loop is ~3x faster than reduce at 60fps
      let sumSquares = 0
      for (let i = 0; i < dataArray.length; i++) sumSquares += dataArray[i] * dataArray[i]
      const rms = Math.sqrt(sumSquares / dataArray.length)
      const level = Math.min(100, Math.round((rms / 255) * 100 * 3))

      const now = Date.now()
      // Read threshold from ref so slider changes take effect without restarting the loop
      const isAboveThreshold = level > thresholdRef.current

      if (isAboveThreshold) {
        sustainedStartRef.current ??= now
      } else {
        sustainedStartRef.current = null
      }

      const isActive =
        sustainedStartRef.current !== null &&
        now - sustainedStartRef.current >= AUDIO_DETECTION.SUSTAINED_DURATION_MS

      setState({ level, isActive })

      if (
        onActivityRef.current &&
        now - lastEmitRef.current >= AUDIO_DETECTION.EMIT_INTERVAL_MS
      ) {
        lastEmitRef.current = now
        onActivityRef.current({ level, isActive })
      }

      animFrameRef.current = requestAnimationFrame(tick)
    }

    animFrameRef.current = requestAnimationFrame(tick)
  }, []) // No deps — reads threshold and callback via refs

  // IMPORTANT: Must be called synchronously inside a user gesture handler on iOS.
  // Creating AudioContext in useEffect or a Promise callback causes iOS to create
  // it in a permanently suspended state that cannot be resumed.
  const initAudioContext = useCallback((streamOverride?: MediaStream | null) => {
    const s = streamOverride ?? stream
    if (!s || contextRef.current) return

    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = AUDIO_DETECTION.FFT_SIZE

    // Use audio-only stream — passing the full stream (with video) to AudioContext
    // causes iOS Safari to consume the video track, resulting in a black camera preview.
    const audioTracks = s.getAudioTracks()
    if (audioTracks.length === 0) return  // No mic — nothing to analyse
    const audioOnlyStream = new MediaStream(audioTracks)
    const source = ctx.createMediaStreamSource(audioOnlyStream)
    source.connect(analyser)

    contextRef.current = ctx
    analyserRef.current = analyser

    startAnalysis()
  }, [stream, startAnalysis])

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current)
      contextRef.current?.close()
      contextRef.current = null
      analyserRef.current = null
    }
  }, [])

  return { ...state, initAudioContext }
}
