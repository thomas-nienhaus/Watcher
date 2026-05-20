'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Camera, Eye, Lock, Wifi, Cloud, Smartphone } from 'lucide-react'
import FeaturePill from '@/components/ui/FeaturePill'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
}

export default function HomePage() {
  return (
    <main className="relative flex flex-col items-center justify-center h-full overflow-hidden bg-surface-0 px-6 pt-safe pb-safe">

      {/* Ambient glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(125,211,252,0.06) 0%, transparent 70%)',
        }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col items-center gap-8 w-full max-w-xs z-10"
      >
        {/* Logo */}
        <motion.div variants={item} className="flex flex-col items-center gap-4">
          <div
            className="w-16 h-16 rounded-[20px] flex items-center justify-center"
            style={{ background: 'rgba(125,211,252,0.1)', border: '1px solid rgba(125,211,252,0.15)' }}
          >
            <Camera size={28} className="text-accent-blue" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white">BabyWatch</h1>
            <p className="text-white/35 text-base mt-1.5">Your baby, always close.</p>
          </div>
        </motion.div>

        {/* Feature pills */}
        <motion.div variants={item} className="flex flex-wrap justify-center gap-2">
          <FeaturePill icon={Lock} label="Privé" />
          <FeaturePill icon={Wifi} label="Peer-to-peer" />
          <FeaturePill icon={Cloud} label="Geen cloud" />
          <FeaturePill icon={Smartphone} label="PWA" />
        </motion.div>

        {/* CTAs */}
        <motion.div variants={item} className="flex flex-col gap-3 w-full">
          <Link
            href="/camera"
            className="flex items-center justify-center gap-3 w-full min-h-[60px] rounded-[var(--radius-button)] bg-accent-blue text-surface-0 font-semibold text-base active:scale-[0.97] transition-transform"
          >
            <Camera size={18} strokeWidth={2} />
            Camera instellen
          </Link>

          <Link
            href="/viewer/join"
            className="flex items-center justify-center gap-3 w-full min-h-[60px] rounded-[var(--radius-button)] bg-surface-2 border border-surface-3 text-white/80 font-medium text-base active:scale-[0.97] transition-transform hover:border-white/15 hover:text-white"
          >
            <Eye size={18} strokeWidth={1.5} />
            Meekijken
          </Link>
        </motion.div>

        {/* Privacy note */}
        <motion.p variants={item} className="text-white/20 text-xs text-center leading-relaxed">
          Geen account · Geen opname · Geen cloud
        </motion.p>
      </motion.div>
    </main>
  )
}
