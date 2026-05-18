'use client'

import React from 'react'

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isMuted: boolean
  onTap: () => void
}

export default function VideoStream({ videoRef, isMuted, onTap }: Props) {
  return (
    <div className="absolute inset-0" onClick={onTap}>
      <video
        ref={videoRef}
        // playsInline is MANDATORY for iOS — video plays inline instead of fullscreen popup
        autoPlay
        playsInline
        // Start muted to satisfy browser autoplay policies; user unmutes via tap
        muted={isMuted}
        className="w-full h-full object-cover bg-black"
      />
      {isMuted && (
        <div className="absolute inset-x-0 bottom-24 flex justify-center pointer-events-none">
          <div className="bg-black/70 backdrop-blur text-white rounded-xl px-4 py-2 text-sm font-medium">
            🔇 Tap to unmute
          </div>
        </div>
      )}
    </div>
  )
}
