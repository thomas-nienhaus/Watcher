'use client'

import { useState } from 'react'
import { normalizeRoomCode, isValidRoomCode } from '@/lib/roomCode'

interface Props {
  onCodeEntered: (code: string) => void
}

export default function QRScanner({ onCodeEntered }: Props) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = normalizeRoomCode(input)
    if (!isValidRoomCode(code)) {
      setError('Invalid code — must be 6 letters or numbers')
      return
    }
    onCodeEntered(code)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-xs">
      <input
        value={input}
        onChange={(e) => {
          setInput(e.target.value.toUpperCase())
          setError('')
        }}
        placeholder="ABCDEF"
        maxLength={6}
        className="text-center text-3xl font-mono tracking-[0.3em]
                   bg-surface border-2 border-gray-700 rounded-2xl p-4
                   text-white uppercase focus:border-primary outline-none
                   transition-colors"
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        inputMode="text"
        spellCheck={false}
      />
      {error && <p className="text-danger text-sm text-center">{error}</p>}
      <button
        type="submit"
        disabled={input.length < 6}
        className="bg-primary text-white rounded-2xl py-4 text-lg font-semibold
                   min-h-[56px] active:scale-95 transition-transform
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Join Room
      </button>
    </form>
  )
}
