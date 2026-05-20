'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Camera, X } from 'lucide-react'
import { isValidRoomCode, normalizeRoomCode } from '@/lib/roomCode'

const CODE_LENGTH = 6

export default function ViewerJoinPage() {
  const [chars, setChars] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
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

  const stopScanner = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setScanning(false)
  }, [])

  const handleScanResult = useCallback((text: string) => {
    // Accept full URL like https://host/viewer/ABC123 or bare code ABC123
    const match = text.match(/\/viewer\/([A-Z2-9]{6})$/i) ?? text.match(/^([A-Z2-9]{6})$/i)
    if (!match) return
    const roomCode = normalizeRoomCode(match[1])
    if (!isValidRoomCode(roomCode)) return
    stopScanner()
    router.push(`/viewer/${roomCode}`)
  }, [router, stopScanner])

  const startScanner = useCallback(async () => {
    setScanning(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const jsQR = (await import('jsqr')).default

      const scan = () => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(scan)
          return
        }
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(video, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const result = jsQR(imageData.data, imageData.width, imageData.height)
        if (result?.data) {
          handleScanResult(result.data)
          return
        }
        rafRef.current = requestAnimationFrame(scan)
      }
      rafRef.current = requestAnimationFrame(scan)
    } catch {
      setScanning(false)
      setError('Camera toegang geweigerd')
    }
  }, [handleScanResult])

  // Clean up on unmount
  useEffect(() => () => stopScanner(), [stopScanner])

  return (
    <main className="relative flex flex-col items-center justify-center h-full bg-surface-0 px-6 pt-safe pb-safe overflow-hidden">

      {/* Subtle background glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(125,211,252,0.04) 0%, transparent 70%)' }}
      />

      {/* QR scanner overlay */}
      <AnimatePresence>
        {scanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black flex flex-col"
          >
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Viewfinder */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-56 h-56 relative">
                {/* Corner markers */}
                {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
                  <div
                    key={pos}
                    className={`absolute w-8 h-8 border-accent-blue border-2
                      ${pos.includes('top') ? 'top-0' : 'bottom-0'}
                      ${pos.includes('left') ? 'left-0' : 'right-0'}
                      ${pos === 'top-left' ? 'border-r-0 border-b-0 rounded-tl-lg' : ''}
                      ${pos === 'top-right' ? 'border-l-0 border-b-0 rounded-tr-lg' : ''}
                      ${pos === 'bottom-left' ? 'border-r-0 border-t-0 rounded-bl-lg' : ''}
                      ${pos === 'bottom-right' ? 'border-l-0 border-t-0 rounded-br-lg' : ''}
                    `}
                  />
                ))}
              </div>
            </div>

            <p className="absolute bottom-32 inset-x-0 text-center text-white/50 text-sm pb-safe">
              Richt op de QR-code van het camera-apparaat
            </p>

            <button
              onClick={stopScanner}
              className="absolute top-0 right-0 pt-safe p-5 text-white/60 hover:text-white"
              aria-label="Scanner sluiten"
            >
              <X size={24} strokeWidth={1.5} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
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

          <button
            type="button"
            onClick={startScanner}
            className="flex items-center justify-center gap-2 w-full min-h-[56px]
                       rounded-[var(--radius-button)] bg-surface-2 border border-surface-3
                       text-white/60 font-medium text-base active:scale-[0.97] transition-all
                       hover:border-white/15 hover:text-white"
          >
            <Camera size={17} strokeWidth={1.5} />
            QR-code scannen
          </button>
        </form>
      </motion.div>
    </main>
  )
}
