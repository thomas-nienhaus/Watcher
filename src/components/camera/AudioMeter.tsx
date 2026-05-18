'use client'

interface Props {
  level: number    // 0–100
  isActive: boolean
}

const BAR_COUNT = 20

export default function AudioMeter({ level, isActive }: Props) {
  const filled = Math.round((level / 100) * BAR_COUNT)

  return (
    <div className="flex items-center gap-1" aria-label={`Audio level: ${level}%`}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          className={`h-4 w-1.5 rounded-sm transition-all duration-75 ${
            i < filled
              ? isActive
                ? 'bg-danger'
                : i < filled * 0.6
                ? 'bg-primary'
                : 'bg-warning'
              : 'bg-gray-700'
          }`}
        />
      ))}
      {isActive && (
        <span className="ml-2 text-danger text-xs font-bold animate-pulse tracking-wide">
          SOUND
        </span>
      )}
    </div>
  )
}
