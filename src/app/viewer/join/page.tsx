'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isValidRoomCode, normalizeRoomCode } from '@/lib/roomCode'

export default function ViewerJoinPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const normalized = normalizeRoomCode(code)
    if (!isValidRoomCode(normalized)) {
      setError('Please enter a valid 6-character room code')
      return
    }
    router.push(`/viewer/${normalized}`)
  }

  return (
    <main className="flex flex-col items-center justify-center h-full gap-8 p-6 pt-safe pb-safe">
      <div className="text-center">
        <div className="text-5xl mb-3">👁️</div>
        <h1 className="text-3xl font-bold text-white">Watch Feed</h1>
        <p className="text-gray-400 mt-2">Enter the room code shown on the camera device</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-xs">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
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
          className="bg-primary text-white rounded-2xl py-4 text-lg font-semibold
                     min-h-[56px] active:scale-95 transition-transform
                     disabled:opacity-50"
          disabled={code.length < 6}
        >
          Connect
        </button>
      </form>

      <Link href="/" className="text-gray-500 text-sm hover:text-gray-300 transition-colors">
        ← Back
      </Link>
    </main>
  )
}
