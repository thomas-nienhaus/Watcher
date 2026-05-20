'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface Props {
  code: string
  size?: 'sm' | 'lg'
}

export default function RoomCodeDisplay({ code, size = 'lg' }: Props) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available
    }
  }

  const half = Math.ceil(code.length / 2)
  const left = code.slice(0, half)
  const right = code.slice(half)

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-3 group"
      aria-label="Copy room code"
    >
      <span
        className={`font-mono font-bold tracking-[0.25em] text-white ${
          size === 'lg' ? 'text-4xl' : 'text-xl'
        }`}
      >
        {left} {right}
      </span>
      <span className="text-white/20 group-hover:text-white/50 transition-colors">
        {copied
          ? <Check size={14} className="text-accent-sage" />
          : <Copy size={14} />
        }
      </span>
    </button>
  )
}
