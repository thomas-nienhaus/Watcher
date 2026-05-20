'use client'

import { useEffect, useState } from 'react'
import type { BatteryManager } from '@/types'

export interface BatteryState {
  level: number | null    // 0–100 percentage
  charging: boolean | null
  isSupported: boolean
}

export function useBattery(): BatteryState {
  const [state, setState] = useState<BatteryState>({
    level: null,
    charging: null,
    isSupported: false,
  })

  useEffect(() => {
    if (!navigator.getBattery) return

    let battery: BatteryManager | null = null

    const update = () => {
      if (!battery) return
      setState({
        level: Math.round(battery.level * 100),
        charging: battery.charging,
        isSupported: true,
      })
    }

    navigator.getBattery().then((b) => {
      battery = b
      update()
      b.addEventListener('levelchange', update)
      b.addEventListener('chargingchange', update)
    }).catch((err) => {
      console.warn('[Battery] API unavailable:', err)
    })

    return () => {
      battery?.removeEventListener('levelchange', update)
      battery?.removeEventListener('chargingchange', update)
    }
  }, [])

  return state
}
