'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports as MacIntel but has touch
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export default function IOSWarning() {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isIOS() && !dismissed) setVisible(true)
  }, [dismissed])

  // Re-show warning if user returns from background (stream may have paused)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isIOS()) {
        setDismissed(false)
        setVisible(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-warning text-black px-4 py-3 pt-safe">
      <div className="flex items-start gap-3 max-w-lg mx-auto">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">iOS limitation</p>
          <p className="text-xs mt-0.5 leading-relaxed">
            Keep this tab open and your screen unlocked. Locking the screen or switching
            apps will pause the camera stream.
          </p>
        </div>
        <button
          onClick={() => {
            setVisible(false)
            setDismissed(true)
          }}
          className="text-black/60 hover:text-black font-bold text-xl leading-none px-1 shrink-0"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  )
}
