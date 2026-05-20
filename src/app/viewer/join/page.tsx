'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { isValidRoomCode, normalizeRoomCode } from '@/lib/roomCode'

const CODE_LENGTH = 6

export default function ViewerJoinPage() {
  const [chars, setChars] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [error, setError] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const router = useRouter()

  const code = chars.join('')

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !chars[i] && i > 0) {
      inputRefs.current[i - 1]?.focus()
    }
  }

  const handleChange = (i: number, val: string) => {
    const char = val.replace(/[^a-zA-Z2-9]/g, '').slice(-1).toUpperCase()
    const next = [...chars]
    next[i] = char
    setChars(next)
    setError('')
    if (char && i < CODE_LENGTH - 1) {
      inputRefs.current[i + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\s/g, '').toUpperCase().slice(0, CODE_LENGTH)
    const next = Array(CODE_LENGTH).fill('')
    pasted.split('').forEach((c, i) => { next[i] = c })
    setChars(next)
    const focusIdx = Math.min(pasted.length, CODE_LENGTH - 1)
    inputRefs.current[focusIdx]?.focus()
    e.preventDefault()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const normalized = normalizeRoomCode(code)
    if (!isValidRoomCode(normalized)) {
      setError('Voer een geldige 6-tekens code in')
      return
    }
    router.push(`/viewer/${normalized}`)
  }

  return (
    <main className="relative flex flex-col items-center justify-center h-full bg-surface-0 px-6 pt-safe pb-safe overflow-hidden">

      {/* Subtle background glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(125,211,252,0.04) 0%, transparent 70%)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-10 w-full max-w-xs z-10"
      >
        {/* Back */}
        <Link
          href="/"
          className="self-start flex items-center gap-1.5 text-white/35 hover:text-white/70 transition-colors text-sm"
        >
          <ArrowLeft size={14} />
          Terug
        </Link>

        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">Voer code in</h1>
          <p className="text-white/35 text-sm mt-2">6-tekens code van het camera-apparaat</p>
        </div>

        {/* 6-box input */}
        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6 w-full">
          <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
            {chars.map((char, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el }}
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                maxLength={2}
                value={char}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-12 h-14 text-center text-xl font-mono font-bold text-white
                           bg-surface-2 border border-surface-3 rounded-xl
                           focus:border-accent-blue/60 focus:bg-surface-1 focus:outline-none
                           transition-all duration-200 uppercase caret-accent-blue"
                aria-label={`Teken ${i + 1}`}
              />
            ))}
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-live/80 text-sm text-center"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={code.length < CODE_LENGTH}
            className="flex items-center justify-center gap-2 w-full min-h-[56px]
                       rounded-[var(--radius-button)] bg-accent-blue text-surface-0
                       font-semibold text-base active:scale-[0.97] transition-all duration-200
                       disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            Verbinden
            <ArrowRight size={16} strokeWidth={2} />
          </button>
        </form>
      </motion.div>
    </main>
  )
}
