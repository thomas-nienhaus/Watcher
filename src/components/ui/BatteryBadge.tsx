'use client'

import { BatteryFull, BatteryMedium, BatteryLow, BatteryCharging } from 'lucide-react'

interface Props {
  level: number
  charging: boolean
}

export default function BatteryBadge({ level, charging }: Props) {
  const color =
    charging ? 'text-accent-sage' :
    level > 50 ? 'text-white/60' :
    level > 20 ? 'text-warning' :
    'text-live'

  const Icon =
    charging ? BatteryCharging :
    level > 60 ? BatteryFull :
    level > 25 ? BatteryMedium :
    BatteryLow

  return (
    <div className={`flex items-center gap-1 ${color}`}>
      <Icon size={14} strokeWidth={1.5} />
      <span className="text-xs font-medium">{level}%</span>
    </div>
  )
}
