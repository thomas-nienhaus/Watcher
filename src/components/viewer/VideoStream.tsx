'use client'

import React from 'react'
import { VolumeX } from 'lucide-react'

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
        autoPlay
        playsInline
        muted={isMuted}
        className="w-full h-full object-cover bg-black"
      />
      {isMuted && (
        <div className="absolute inset-x-0 bottom-28 flex justify-center pointer-events-none">
          <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-2">
            <VolumeX size={14} strokeWidth={1.5} className="text-white/50" />
            <span className="text-white/60 text-xs font-medium">Tik om geluid aan te zetten</span>
          </div>
        </div>
      )}
    </div>
  )
}
