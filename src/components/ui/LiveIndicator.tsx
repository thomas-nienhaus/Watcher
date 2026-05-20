'use client'

import { motion } from 'framer-motion'

export default function LiveIndicator() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex items-center justify-center w-2 h-2">
        <motion.div
          className="absolute w-full h-full rounded-full bg-live"
          animate={{ scale: [1, 1.8, 1], opacity: [1, 0, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
        <div className="w-2 h-2 rounded-full bg-live glow-live" />
      </div>
      <span className="text-xs font-semibold tracking-widest text-live/80 uppercase">
        Live
      </span>
    </div>
  )
}
