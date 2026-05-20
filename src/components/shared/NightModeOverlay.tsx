'use client'

import { motion } from 'framer-motion'

interface Props {
  active: boolean
}

export default function NightModeOverlay({ active }: Props) {
  return (
    <motion.div
      className="fixed inset-0 pointer-events-none z-50 mix-blend-multiply"
      style={{ backgroundColor: '#220909' }}
      animate={{ opacity: active ? 0.6 : 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      aria-hidden
    />
  )
}
