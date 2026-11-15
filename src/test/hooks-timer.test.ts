import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCountdown } from '@/hooks/use-countdown'
import { usePomodoro } from '@/hooks/use-pomodoro'

describe('Timer Hooks and Countdown Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('useCountdown', () => {
    it('returns configured: false when targetDate is null', () => {
      const { result } = renderHook(() => useCountdown(null))
      expect(result.current.configured).toBe(false)
    })

    it('calculates accurate remaining days, hours, minutes, seconds for future date', () => {
      const now = new Date('2027-01-01T00:00:00Z')
      vi.setSystemTime(now)

      // Exam in 30 days, 2 hours, 15 minutes, 40 seconds
      const targetDate = new Date('2027-01-31T02:15:40Z')
      const { result } = renderHook(() => useCountdown(targetDate))

      expect(result.current.configured).toBe(true)
      if (result.current.configured) {
        expect(result.current.days).toBe(30)
        expect(result.current.hours).toBe(2)
        expect(result.current.minutes).toBe(15)
        expect(result.current.seconds).toBe(40)
        expect(result.current.isPast).toBe(false)
      }
    })

    it('identifies past dates correctly', () => {
      const now = new Date('2027-03-01T00:00:00Z')
      vi.setSystemTime(now)

      const targetDate = new Date('2027-02-01T00:00:00Z')
      const { result } = renderHook(() => useCountdown(targetDate))

      expect(result.current.configured).toBe(true)
      if (result.current.configured) {
        expect(result.current.isPast).toBe(true)
        expect(result.current.days).toBe(0)
      }
    })
  })

  describe('usePomodoro', () => {
    it('initializes in focus phase with 1500 seconds (25 minutes)', () => {
      const { result } = renderHook(() => usePomodoro())
      expect(result.current.phase).toBe('focus')
      expect(result.current.timeRemaining).toBe(1500)
      expect(result.current.isRunning).toBe(false)
      expect(result.current.sessionCount).toBe(0)
    })

    it('starts, pauses, and resumes timer correctly', () => {
      const { result } = renderHook(() => usePomodoro())

      act(() => {
        result.current.start()
      })
      expect(result.current.isRunning).toBe(true)

      act(() => {
        vi.advanceTimersByTime(5000)
      })
      expect(result.current.timeRemaining).toBe(1495)

      act(() => {
        result.current.pause()
      })
      expect(result.current.isRunning).toBe(false)

      act(() => {
        vi.advanceTimersByTime(5000)
      })
      // Time should not advance while paused
      expect(result.current.timeRemaining).toBe(1495)

      act(() => {
        result.current.resume()
      })
      expect(result.current.isRunning).toBe(true)
    })

    it('resets timer back to full duration', () => {
      const { result } = renderHook(() => usePomodoro())

      act(() => {
        result.current.start()
      })
      act(() => {
        vi.advanceTimersByTime(10000)
      })
      expect(result.current.timeRemaining).toBe(1490)

      act(() => {
        result.current.reset()
      })
      expect(result.current.timeRemaining).toBe(1500)
      expect(result.current.isRunning).toBe(false)
    })

    it('switches to short-break after focus session completes', () => {
      const { result } = renderHook(() => usePomodoro())

      act(() => {
        result.current.start()
      })
      act(() => {
        // Fast forward 25 minutes
        vi.advanceTimersByTime(1500 * 1000)
      })

      expect(result.current.phase).toBe('short-break')
      expect(result.current.sessionCount).toBe(1)
      expect(result.current.timeRemaining).toBe(300) // 5 minutes
    })

    it('allows skipping phases', () => {
      const { result } = renderHook(() => usePomodoro())

      act(() => {
        result.current.skipPhase()
      })
      expect(result.current.phase).toBe('short-break')
    })
  })
})
