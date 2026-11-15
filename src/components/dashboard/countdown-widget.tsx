'use client'

import { Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCountdown } from '@/hooks/use-countdown'

interface CountdownWidgetProps {
  csExamDate: Date | null
  daExamDate: Date | null
}

function CountdownDisplay({ label, date }: { label: string; date: Date | null }) {
  const result = useCountdown(date)
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      {!result.configured ? (
        <p className="text-xs text-slate-400 italic">Official paper schedule not configured.</p>
      ) : result.isPast ? (
        <p className="text-xs text-slate-400">Examination date has passed.</p>
      ) : (
        <div className="flex gap-2 text-sm font-mono font-semibold text-indigo-600 dark:text-indigo-400">
          <span>{result.days}d</span>
          <span>{String(result.hours).padStart(2, '0')}h</span>
          <span>{String(result.minutes).padStart(2, '0')}m</span>
          <span>{String(result.seconds).padStart(2, '0')}s</span>
        </div>
      )}
    </div>
  )
}

export function CountdownWidget({ csExamDate, daExamDate }: CountdownWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-indigo-500" />
          GATE 2027 Countdown
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <CountdownDisplay label="GATE CS 2027" date={csExamDate} />
        <CountdownDisplay label="GATE DA 2027" date={daExamDate} />
      </CardContent>
    </Card>
  )
}
