import { InputHTMLAttributes } from 'react'

interface SliderProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  value: number
  min?: number
  max?: number
}

export default function Slider({ label, value, min = 0, max = 100, ...props }: SliderProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center text-sm">
        <label className="text-gray-400">{label}</label>
        <span className="text-gray-200 font-mono w-8 text-right">{value}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        className="w-full h-2 accent-primary cursor-pointer rounded-full"
        {...props}
      />
    </div>
  )
}
