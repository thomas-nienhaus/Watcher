'use client'

import { motion } from 'framer-motion'
import { Loader2, WifiOff, RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'
import type { ViewerPageState } from '@/types'

interface Props {
  state: ViewerPageState
  error: string | null
  onReconnect: () => void
}

export default function ConnectionStatus({ state, error, onReconnect }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      className="flex flex-col items-center gap-6 p-8 text-center max-w-xs"
    >
      {state === 'connecting' && (
        <>
          <Loader2 size={40} strokeWidth={1} className="text-white/30 animate-spin" />
          <div>
            <p className="text-white font-semibold text-lg">Verbinden…</p>
            <p className="text-white/35 text-sm mt-1">Signaalserver bereiken</p>
          </div>
        </>
      )}

      {state === 'waiting-for-camera' && (
        <>
          <div className="relative flex items-center justify-center w-12 h-12">
            <motion.div
              className="absolute w-full h-full rounded-full border border-white/15"
              animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute w-full h-full rounded-full border border-white/10"
              animate={{ scale: [1, 1.8, 1], opacity: [0.2, 0, 0.2] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
            />
            <div className="w-2 h-2 rounded-full bg-white/40" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg">Wachten op camera…</p>
            <p className="text-white/35 text-sm mt-1">
              Start de camera op het andere apparaat
            </p>
          </div>
        </>
      )}

      {(state === 'disconnected' || state === 'error') && (
        <>
          <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-surface-3 flex items-center justify-center">
            <WifiOff size={22} strokeWidth={1.5} className="text-white/40" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg">Camera offline</p>
            {error && <p className="text-white/35 text-sm mt-1">{error}</p>}
          </div>
          <Button onClick={onReconnect} size="lg" className="w-full">
            <RefreshCw size={15} strokeWidth={1.5} />
            Opnieuw verbinden
          </Button>
        </>
      )}
    </motion.div>
  )
}
