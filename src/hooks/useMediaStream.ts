'use client'

import { useCallback, useRef, useState } from 'react'
import type { CameraFacing, MediaStreamState } from '@/types'

const VIDEO_CONSTRAINTS: Record<CameraFacing, MediaTrackConstraints> = {
  user: {
    facingMode: 'user',
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
  environment: {
    facingMode: 'environment',
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
}

export function useMediaStream() {
  const [state, setState] = useState<MediaStreamState>({
    stream: null,
    error: null,
    isRequesting: false,
    facing: 'environment',
  })
  const streamRef = useRef<MediaStream | null>(null)

  const startStream = useCallback(async (facing: CameraFacing = 'environment') => {
    setState((s) => ({ ...s, isRequesting: true, error: null }))
    try {
      // Stop any existing tracks before requesting a new stream
      streamRef.current?.getTracks().forEach((t) => t.stop())

      const stream = await navigator.mediaDevices.getUserMedia({
        video: VIDEO_CONSTRAINTS[facing],
        audio: {
          // Disable processing — we want raw audio for the baby monitor
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      streamRef.current = stream
      setState({ stream, error: null, isRequesting: false, facing })
    } catch (err) {
      let message = 'Could not access camera'
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          message = 'Camera permission denied. Tap Allow and try again.'
        } else if (err.name === 'NotFoundError') {
          message = 'No camera found on this device.'
        } else if (err.name === 'NotReadableError') {
          message = 'Camera is in use by another app.'
        } else {
          message = err.message
        }
      }
      setState((s) => ({ ...s, stream: null, error: message, isRequesting: false }))
    }
  }, [])

  const flipCamera = useCallback(() => {
    const next: CameraFacing = state.facing === 'environment' ? 'user' : 'environment'
    startStream(next)
  }, [state.facing, startStream])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setState((s) => ({ ...s, stream: null }))
  }, [])

  return { ...state, streamRef, startStream, flipCamera, stopStream }
}
