'use client'

import Button from '@/components/ui/Button'
import Slider from '@/components/ui/Slider'

interface Props {
  onFlip: () => void
  onToggleNightMode: () => void
  isNightMode: boolean
  audioThreshold: number
  onThresholdChange: (value: number) => void
}

export default function CameraControls({
  onFlip,
  onToggleNightMode,
  isNightMode,
  audioThreshold,
  onThresholdChange,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 justify-center">
        <Button variant="secondary" size="sm" onClick={onFlip} aria-label="Flip camera">
          🔄 Flip
        </Button>
        <Button
          variant={isNightMode ? 'danger' : 'secondary'}
          size="sm"
          onClick={onToggleNightMode}
          aria-label={isNightMode ? 'Disable night mode' : 'Enable night mode'}
        >
          {isNightMode ? '🌕 Night On' : '🌑 Night Mode'}
        </Button>
      </div>

      <div className="px-1">
        <Slider
          label="Sound sensitivity"
          value={audioThreshold}
          min={5}
          max={80}
          onChange={(e) => onThresholdChange(Number(e.target.value))}
        />
      </div>
    </div>
  )
}
