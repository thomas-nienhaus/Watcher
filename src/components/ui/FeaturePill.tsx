'use client'

import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  label: string
}

export default function FeaturePill({ icon: Icon, label }: Props) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-2 border border-surface-3">
      <Icon size={11} className="text-white/40" strokeWidth={1.5} />
      <span className="text-xs text-white/40 font-medium">{label}</span>
    </div>
  )
}
