'use client'

interface Props {
  level: number | null   // 0–100
  charging: boolean | null
}

export default function BatteryStatus({ level, charging }: Props) {
  if (level === null) return null

  const color =
    level > 50 ? 'text-primary' : level > 20 ? 'text-warning' : 'text-danger'

  return (
    <div
      className={`flex items-center gap-1 text-sm font-medium ${color}`}
      title="Camera device battery"
    >
      <span>{charging ? '⚡' : '🔋'}</span>
      <span>{level}%</span>
    </div>
  )
}
