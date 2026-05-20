'use client'

import { motion, useReducedMotion } from 'framer-motion'

interface Props {
  level: number      // 0–100
  isActive: boolean
  nightMode?: boolean
  size?: 'sm' | 'md'
}

export default function AudioPulse({ level, isActive, nightMode = false, size = 'md' }: Props) {
  const reduced = useReducedMotion()
  const color = nightMode ? '#FF4D4D' : '#7DD3FC'
  const dim = size === 'sm' ? 20 : 32
  const rings = [1, 1.5, 2]

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex items-center justify-center" style={{ width: dim * 2, height: dim * 2 }}>
        {rings.map((scale, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border"
            style={{
              width: dim,
              height: dim,
              borderColor: color,
            }}
            animate={
              !reduced && isActive
                ? {
                    scale: [1, scale, 1],
                    opacity: [0.6 - i * 0.15, 0, 0.6 - i * 0.15],
                  }
                : { scale: 1, opacity: isActive ? 0.3 : 0.1 }
            }
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.3,
              ease: 'easeOut',
            }}
          />
        ))}
        <motion.div
          className="rounded-full"
          style={{ width: dim * 0.4, height: dim * 0.4, backgroundColor: color }}
          animate={{ opacity: 0.4 + (level / 100) * 0.6 }}
          transition={{ duration: 0.1 }}
        />
      </div>

      {size === 'md' && (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-white/40 font-medium">Geluidsniveau</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: 12 }).map((_, i) => {
              const filled = Math.round((level / 100) * 12)
              return (
                <motion.div
                  key={i}
                  className="rounded-sm"
                  style={{
                    width: 3,
                    height: i < filled ? 12 + (i / 12) * 8 : 8,
                    backgroundColor:
                      i < filled
                        ? isActive
                          ? nightMode ? '#FF4D4D' : '#7DD3FC'
                          : 'rgba(255,255,255,0.3)'
                        : 'rgba(255,255,255,0.08)',
                  }}
                  animate={{ height: i < filled ? 12 + (i / 12) * 8 : 8 }}
                  transition={{ duration: 0.08 }}
                />
              )
            })}
            {isActive && (
              <motion.span
                className="ml-1 text-xs font-semibold tracking-wide"
                style={{ color: nightMode ? '#FF4D4D' : '#7DD3FC' }}
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                geluid
              </motion.span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
