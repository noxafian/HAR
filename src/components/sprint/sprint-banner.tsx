'use client'

import Link from 'next/link'
import { Rocket, ArrowRight } from 'lucide-react'
import { useCountdown } from '@/hooks/use-countdown'
import { GATE_CS_DATE, SPRINT_THRESHOLD_DAYS } from '@/lib/exam-dates'

/**
 * Self-contained sprint banner. Shown only while GATE CS is configured, not yet
 * past, and within SPRINT_THRESHOLD_DAYS days. Renders nothing otherwise.
 */
export function SprintBanner() {
  const result = useCountdown(GATE_CS_DATE)
  if (!result.configured || result.isPast || result.days > SPRINT_THRESHOLD_DAYS) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-gradient-to-r from-indigo-600 to-amber-500 p-4 text-white shadow-md">
      <div className="flex items-center gap-3">
        <Rocket className="h-5 w-5 shrink-0" />
        <p className="text-sm font-semibold sm:text-base">
          Sprint Mode — {result.days} days to GATE CS
        </p>
      </div>
      <Link
        href="/app/sprint"
        className="inline-flex items-center gap-1 rounded-md bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25"
      >
        Go to Sprint Dashboard <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

export default SprintBanner
