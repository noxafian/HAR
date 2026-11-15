'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, RotateCcw, Settings, Loader2 } from 'lucide-react'
import { usePomodoro } from '@/hooks/use-pomodoro'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDuration } from '@/lib/utils'
import { apiRequest, jsonBody } from '@/lib/client/api'

export default function FocusTimerPage() {
  const pomo = usePomodoro()
  const phaseLabels = { focus: 'Focus Session', 'short-break': 'Short Break', 'long-break': 'Long Break' }
  const phaseRef = useRef(pomo.phase)
  const focusStartedAt = useRef<number | null>(null)
  const activeSegmentStartedAt = useRef<number | null>(null)
  const elapsedFocusMs = useRef(0)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  function startTimer() {
    if (pomo.phase === 'focus') {
      if (focusStartedAt.current === null) focusStartedAt.current = Date.now()
      activeSegmentStartedAt.current = Date.now()
    }
    pomo.start()
  }
  function pauseTimer() {
    if (pomo.phase === 'focus' && activeSegmentStartedAt.current !== null) {
      elapsedFocusMs.current += Date.now() - activeSegmentStartedAt.current
      activeSegmentStartedAt.current = null
    }
    pomo.pause()
  }
  function resetTimer() {
    pomo.reset()
    focusStartedAt.current = null
    activeSegmentStartedAt.current = null
    elapsedFocusMs.current = 0
    phaseRef.current = 'focus'
  }
  function skipTimer() {
    if (pomo.phase === 'focus') {
      if (activeSegmentStartedAt.current !== null) elapsedFocusMs.current += Date.now() - activeSegmentStartedAt.current
      activeSegmentStartedAt.current = null
    }
    pomo.skipPhase()
  }

  useEffect(() => {
    if (phaseRef.current === 'focus' && pomo.phase !== 'focus') {
      if (activeSegmentStartedAt.current !== null) elapsedFocusMs.current += Date.now() - activeSegmentStartedAt.current
      activeSegmentStartedAt.current = null
      const durationMs = elapsedFocusMs.current
      const startedAt = focusStartedAt.current
      focusStartedAt.current = null
      elapsedFocusMs.current = 0
      if (startedAt !== null && durationMs >= 60_000) {
        const ended = Date.now()
        setSaving(true); setError('')
        void apiRequest('/api/v1/planner/focus-sessions', {
          method: 'POST', body: jsonBody({ startTime: new Date(startedAt).toISOString(), endTime: new Date(ended).toISOString(), durationMinutes: Math.min(480, Math.max(1, Math.round(durationMs / 60_000))), sessionType: 'focused' }),
        }).then(() => setNotice('Focus session saved to your study history.')).catch(e => setError(e instanceof Error ? e.message : 'Could not save focus session')).finally(() => setSaving(false))
      }
    }
    phaseRef.current = pomo.phase
  }, [pomo.phase])

  return <div className="mx-auto max-w-2xl space-y-6">
    <div><h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Focus Timer</h1><p className="mt-1 text-sm text-slate-500">Pomodoro timer. Completed focus periods are recorded in your study history.</p></div>
    {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</div>}
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
    <Card><CardContent className="flex flex-col items-center gap-6 pb-10 pt-10"><div className="text-center"><p className="text-sm font-medium text-slate-500">{phaseLabels[pomo.phase]}</p><p className="mt-2 text-6xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{formatDuration(pomo.timeRemaining)}</p></div><div className="flex flex-wrap items-center justify-center gap-3">{!pomo.isRunning ? <Button size="lg" onClick={startTimer}><Play className="mr-1.5 h-4 w-4"/>Start</Button> : <Button size="lg" variant="secondary" onClick={pauseTimer}><Pause className="mr-1.5 h-4 w-4"/>Pause</Button>}<Button size="lg" variant="outline" onClick={resetTimer}><RotateCcw className="mr-1.5 h-4 w-4"/>Reset</Button><Button size="lg" variant="ghost" onClick={skipTimer}>Skip Phase</Button></div><div className="text-center"><p className="text-sm text-slate-500">Sessions completed: <span className="font-semibold">{pomo.sessionCount}</span></p>{saving && <p className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin"/>Saving session…</p>}</div></CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Settings className="h-4 w-4"/>Timer Settings</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><div className="flex flex-col gap-1.5"><Label htmlFor="focus-duration">Focus (minutes)</Label><Input id="focus-duration" type="number" min="1" max="120" value={pomo.config.focusMinutes} onChange={e => pomo.setConfig({ focusMinutes: Number(e.target.value) })}/></div><div className="flex flex-col gap-1.5"><Label htmlFor="short-break">Short break (minutes)</Label><Input id="short-break" type="number" min="1" max="30" value={pomo.config.shortBreakMinutes} onChange={e => pomo.setConfig({ shortBreakMinutes: Number(e.target.value) })}/></div><div className="flex flex-col gap-1.5"><Label htmlFor="long-break">Long break (minutes)</Label><Input id="long-break" type="number" min="1" max="60" value={pomo.config.longBreakMinutes} onChange={e => pomo.setConfig({ longBreakMinutes: Number(e.target.value) })}/></div></CardContent></Card>
  </div>
}
