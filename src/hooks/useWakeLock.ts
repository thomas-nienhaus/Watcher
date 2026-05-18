'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface WakeLockControls {
  isLocked: boolean
  isSupported: boolean
  enable: () => Promise<void>
  disable: () => void
}

export function useWakeLock(): WakeLockControls {
  const [isLocked, setIsLocked] = useState(false)
  const [isSupported] = useState(
    () => typeof navigator !== 'undefined' && 'wakeLock' in navigator
  )
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  // nosleep.js has no reliable TS types; use unknown and cast at call site
  const noSleepRef = useRef<{ enable: () => Promise<void>; disable: () => void } | null>(null)

  const enable = useCallback(async () => {
    // Prefer native Wake Lock API (Chrome, Edge, recent Safari)
    if (isSupported) {
      try {
        wakeLockRef.current = await navigator.wakeLock!.request('screen')
        wakeLockRef.current.addEventListener('release', () => setIsLocked(false))
        setIsLocked(true)
        return
      } catch {
        // Fall through to NoSleep.js on failure
      }
    }

    // iOS Safari fallback: NoSleep.js uses a hidden video trick.
    // Dynamic import required — nosleep.js references `document` at module load time
    // which would crash during SSR.
    try {
      const mod = await import('nosleep.js')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const NoSleep = (mod as any).default ?? mod
      if (!noSleepRef.current) {
        noSleepRef.current = new NoSleep()
      }
      await noSleepRef.current!.enable()
      setIsLocked(true)
    } catch (err) {
      console.warn('[WakeLock] NoSleep.js fallback failed:', err)
    }
  }, [isSupported])

  const disable = useCallback(() => {
    wakeLockRef.current?.release()
    wakeLockRef.current = null
    noSleepRef.current?.disable()
    setIsLocked(false)
  }, [])

  // Re-acquire lock when page becomes visible again (e.g. user returned from another app)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isLocked) {
        await enable()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isLocked, enable])

  return { isLocked, isSupported, enable, disable }
}
