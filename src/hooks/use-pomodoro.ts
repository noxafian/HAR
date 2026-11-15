'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export type PomodoroPhase = 'focus' | 'short-break' | 'long-break'

export interface PomodoroConfig {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  sessionsBeforeLongBreak: number
}

export const DEFAULT_CONFIG: PomodoroConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
}

export interface PomodoroState {
  phase: PomodoroPhase
  timeRemaining: number
  isRunning: boolean
  sessionCount: number
  config: PomodoroConfig
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  setConfig: (config: Partial<PomodoroConfig>) => void
  skipPhase: () => void
}

function phaseDuration(phase: PomodoroPhase, config: PomodoroConfig): number {
  if (phase === 'focus') return config.focusMinutes * 60
  if (phase === 'short-break') return config.shortBreakMinutes * 60
  return config.longBreakMinutes * 60
}

export function usePomodoro(): PomodoroState {
  const [config, setConfigState] = useState<PomodoroConfig>(DEFAULT_CONFIG)
  const [phase, setPhase] = useState<PomodoroPhase>('focus')
  const [timeRemaining, setTimeRemaining] = useState(DEFAULT_CONFIG.focusMinutes * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionCountRef = useRef(sessionCount)

  useEffect(() => {
    sessionCountRef.current = sessionCount
  }, [sessionCount])

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isRunning) return
    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearTimer()
          setIsRunning(false)
          // Advance phase
          setPhase((currentPhase) => {
            if (currentPhase === 'focus') {
              const nextCount = sessionCountRef.current + 1
              setSessionCount(nextCount)
              const nextPhase = nextCount % config.sessionsBeforeLongBreak === 0 ? 'long-break' : 'short-break'
              setTimeRemaining(phaseDuration(nextPhase, config))
              return nextPhase
            } else {
              setTimeRemaining(phaseDuration('focus', config))
              return 'focus'
            }
          })
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return clearTimer
  }, [isRunning, config, clearTimer])

  const start = useCallback(() => setIsRunning(true), [])
  const pause = useCallback(() => { clearTimer(); setIsRunning(false) }, [clearTimer])
  const resume = useCallback(() => setIsRunning(true), [])
  const reset = useCallback(() => {
    clearTimer()
    setIsRunning(false)
    setPhase('focus')
    setTimeRemaining(config.focusMinutes * 60)
    setSessionCount(0)
  }, [clearTimer, config])

  const skipPhase = useCallback(() => {
    clearTimer()
    setIsRunning(false)
    setPhase((currentPhase) => {
      let next: PomodoroPhase
      if (currentPhase === 'focus') {
        next = sessionCount + 1 >= config.sessionsBeforeLongBreak ? 'long-break' : 'short-break'
      } else {
        next = 'focus'
      }
      setTimeRemaining(phaseDuration(next, config))
      return next
    })
  }, [clearTimer, config, sessionCount])

  const setConfig = useCallback((partial: Partial<PomodoroConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...partial }
      setTimeRemaining(phaseDuration(phase, next))
      clearTimer()
      setIsRunning(false)
      return next
    })
  }, [phase, clearTimer])

  return { phase, timeRemaining, isRunning, sessionCount, config, start, pause, resume, reset, setConfig, skipPhase }
}
