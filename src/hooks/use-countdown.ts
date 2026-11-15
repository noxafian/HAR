'use client'

import { useState, useEffect } from 'react'

interface CountdownValue {
  configured: true
  days: number
  hours: number
  minutes: number
  seconds: number
  isPast: boolean
}

interface CountdownUnconfigured {
  configured: false
}

export type CountdownResult = CountdownValue | CountdownUnconfigured

function getCountdown(targetDate: Date): CountdownValue {
  const now = Date.now()
  const diff = targetDate.getTime() - now
  if (diff <= 0) {
    return { configured: true, days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true }
  }
  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return { configured: true, days, hours, minutes, seconds, isPast: false }
}

export function useCountdown(targetDate: Date | null): CountdownResult {
  // Initialize with calculated value to avoid effect setState
  const [result, setResult] = useState<CountdownResult>(() => 
    targetDate ? getCountdown(targetDate) : { configured: false }
  )

  useEffect(() => {
    if (!targetDate) {
      return
    }
    // Update every second
    const id = setInterval(() => setResult(getCountdown(targetDate)), 1000)
    return () => clearInterval(id)
  }, [targetDate])

  return result
}
