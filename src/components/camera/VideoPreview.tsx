'use client'

import { useEffect, useRef } from 'react'

interface Props {
  stream: MediaStream | null
}

export default function VideoPreview({ stream }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <video
      ref={videoRef}
      // All three attributes are REQUIRED for iOS Safari inline playback
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover"
    />
  )
}
