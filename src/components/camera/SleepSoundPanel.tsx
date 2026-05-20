'use client'

import { Volume2, VolumeX } from 'lucide-react'
import type { SleepSoundType } from '@/types'

interface Props {
  sound: SleepSoundType
  volume: number
  onSoundChange: (s: SleepSoundType) => void
  onVolumeChange: (v: number) => void
}

const SOUNDS: { id: SleepSoundType; label: string }[] = [
  { id: 'off',     label: 'Uit' },
  { id: 'white',   label: 'Wit' },
  { id: 'pink',    label: 'Roze' },
  { id: 'brown',   label: 'Bruin' },
  { id: 'rain',    label: 'Regen' },
  { id: 'lullaby', label: 'Slaaplied' },
]

export default function SleepSoundPanel({ sound, volume, onSoundChange, onVolumeChange }: Props) {
  return (
    <div className="flex flex-col gap-2.5">
      {/* Sound selector row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {SOUNDS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onSoundChange(id)}
            aria-label={label}
            aria-pressed={sound === id}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95
              ${sound === id
                ? 'bg-accent-blue/25 border border-accent-blue/40 text-accent-blue'
                : 'bg-white/5 border border-white/8 text-white/45 hover:text-white/70'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Volume slider — only when a sound is playing */}
      {sound !== 'off' && (
        <div className="flex items-center gap-2 px-1">
          <VolumeX size={11} strokeWidth={1.5} className="text-white/25 shrink-0" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="flex-1 h-1 rounded-full accent-accent-blue cursor-pointer"
            aria-label="Slaapgeluid volume"
          />
          <Volume2 size={11} strokeWidth={1.5} className="text-white/25 shrink-0" />
          <span className="text-white/25 text-xs w-7 text-right tabular-nums">
            {Math.round(volume * 100)}%
          </span>
        </div>
      )}
    </div>
  )
}
