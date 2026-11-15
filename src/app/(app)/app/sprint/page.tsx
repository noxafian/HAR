'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Rocket, Loader2, AlertCircle, ClipboardList, RotateCcw, Dumbbell, CalendarDays, ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { apiRequest } from '@/lib/client/api'
import { useCountdown } from '@/hooks/use-countdown'
import { GATE_CS_DATE, SPRINT_THRESHOLD_DAYS } from '@/lib/exam-dates'

interface SprintSummary {
  daysRemaining: number
  paper: string
  mockAttemptsLast30Days: number
  avgScoreLast30Days: number
  weeklyTrend: { week: string; avgScore: number; studyMinutes: number }[]
  weakestTopics: { topic: string; subject: string; mistakeCount: number; accuracy: number | null }[]
  dueRevisionCount: number
  suggestedAction: string
}
interface TrendWeek { weekLabel: string; avgScore: number; accuracy: number; studyMinutes: number; mockCount: number }
interface TrendResponse { weeks: TrendWeek[] }

const PYQ_YEARS = [2023, 2022, 2021]

export default function SprintPage() {
  const [summary, setSummary] = useState<SprintSummary | null>(null)
  const [trend, setTrend] = useState<TrendWeek[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest<SprintSummary>('/api/v1/analytics/sprint-summary'),
      apiRequest<TrendResponse>('/api/v1/analytics/trend?weeks=8'),
    ]).then(([s, t]) => {
      if (!active) return
      setSummary(s)
      setTrend(t.weeks)
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load sprint data') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const countdown = useCountdown(GATE_CS_DATE)
  const days = countdown.configured ? countdown.days : SPRINT_THRESHOLD_DAYS
  const ringPct = Math.min(1, Math.max(0, days / SPRINT_THRESHOLD_DAYS))
  const r = 54
  const circ = 2 * Math.PI * r
  const filled = ringPct * circ

  const paper = summary?.paper ?? 'CS'
  const firstWeak = summary?.weakestTopics[0]
  const weakPracticeHref = firstWeak
    ? `/app/practice/${encodeURIComponent(firstWeak.subject)}?timed=30&paper=${paper}&topic=${encodeURIComponent(firstWeak.topic)}`
    : '/app/practice/algorithms'

  const actions = [
    { key: 'Take a full mock test', label: 'Take a full mock test', href: '/app/mock-tests', Icon: ClipboardList },
    { key: 'Review due topics', label: 'Review due topics', href: '/app/revision', Icon: RotateCcw },
    { key: 'Practice weak topics', label: 'Practice weak topics', href: weakPracticeHref, Icon: Dumbbell },
  ]
  const suggested = summary?.suggestedAction ?? 'Take a full mock test'
  const primaryAction = actions.find(a => a.key === suggested) ?? actions[0]
  const secondaryActions = actions.filter(a => a.key !== primaryAction.key)
  const PrimaryIcon = primaryAction.Icon

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading sprint dashboard…
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-10">
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Rocket className="h-6 w-6 text-indigo-500" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Last-Month Sprint</h1>
          <p className="text-sm text-slate-500">Focused plan to push past the GATE qualifying line.</p>
        </div>
      </div>

      {/* (1) Days-remaining hero with progress ring */}
      <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white dark:border-indigo-800 dark:from-indigo-950/40 dark:to-slate-900">
        <CardContent className="flex flex-col items-center gap-8 p-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-6">
            <div className="relative h-[140px] w-[140px]">
              <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90" aria-hidden="true">
                <circle cx="70" cy="70" r={r} fill="none" strokeWidth="10" className="text-slate-200 dark:text-slate-700" stroke="currentColor" />
                <circle cx="70" cy="70" r={r} fill="none" strokeWidth="10" strokeLinecap="round" className="text-indigo-500" stroke="currentColor" strokeDasharray={`${filled} ${circ - filled}`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-3xl font-bold text-indigo-700 dark:text-indigo-300">{days}</span>
                <span className="text-[10px] uppercase tracking-wide text-indigo-500">days left</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">GATE {paper} 2027</p>
              {countdown.configured && !countdown.isPast ? (
                <p className="text-xs text-slate-500">{String(countdown.hours).padStart(2, '0')}h {String(countdown.minutes).padStart(2, '0')}m {String(countdown.seconds).padStart(2, '0')}s remaining</p>
              ) : (
                <p className="text-xs text-slate-500">Official schedule not configured.</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{summary?.mockAttemptsLast30Days ?? 0}</p>
              <p className="text-xs text-slate-500">Mocks (30d)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{summary?.avgScoreLast30Days ?? 0}%</p>
              <p className="text-xs text-slate-500">Avg score (30d)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{summary?.dueRevisionCount ?? 0}</p>
              <p className="text-xs text-slate-500">Due revision</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* (2) Week-over-week trend bar chart (pure CSS, no chart library) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Week-over-week trend</CardTitle>
          <CardDescription>Average mock accuracy by ISO week (0–100%).</CardDescription>
        </CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No trend data yet" description="Take a mock test to start building your trend." />
          ) : (
            <div className="flex items-end gap-2">
              {trend.map(w => (
                <div key={w.weekLabel} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-32 w-full items-end justify-center">
                    <div
                      className="w-full max-w-[2.5rem] rounded-t bg-indigo-500 transition-all"
                      style={{ height: `${Math.max(3, w.avgScore)}%` }}
                      title={`${w.weekLabel}: ${w.avgScore}% · ${w.studyMinutes}m studied · ${w.mockCount} mock(s)`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">{w.weekLabel.replace(/^\d{4}-W/, 'W')}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* (3) Today's Actions */}
      <div>
        <h2 className="mb-3 text-base font-bold text-slate-900 dark:text-slate-100">Today's Actions</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-indigo-200 ring-2 ring-indigo-200 dark:border-indigo-800 dark:ring-indigo-800">
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                <PrimaryIcon className="h-5 w-5" />
                <Badge variant="default">Recommended</Badge>
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{primaryAction.label}</p>
              <Link href={primaryAction.href}><Button className="w-full">Start now <ArrowRight className="h-4 w-4" /></Button></Link>
            </CardContent>
          </Card>
          {secondaryActions.map(a => {
            const Icon = a.Icon
            return (
              <Card key={a.key}>
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{a.label}</p>
                  <Link href={a.href}><Button variant="outline" className="w-full">Go <ArrowRight className="h-4 w-4" /></Button></Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* (4) Year Sprint PYQ quick links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Year Sprint — PYQ revision</CardTitle>
          <CardDescription>Drill the most recent previous year papers first.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {PYQ_YEARS.map(year => (
            <Link key={year} href={`/app/pyq?paper=${paper}&year=${year}`}>
              <Button variant="outline">Revise {year} PYQs</Button>
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* (5) Weakest topics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weakest topics</CardTitle>
            <CardDescription>Topics with the most logged mistakes — practice under timed pressure.</CardDescription>
          </CardHeader>
          <CardContent>
            {!summary || summary.weakestTopics.length === 0 ? (
              <EmptyState icon={Dumbbell} title="No weak topics flagged" description="Mistakes you log while practicing will appear here." />
            ) : (
              <div className="space-y-3">
                {summary.weakestTopics.map(t => (
                  <div key={`${t.subject}-${t.topic}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.topic}</p>
                      <p className="text-xs text-slate-500">{t.subject} · {t.mistakeCount} mistake{t.mistakeCount === 1 ? '' : 's'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.accuracy == null ? <Badge variant="outline">No attempts</Badge> : <Badge variant={t.accuracy < 50 ? 'destructive' : 'warning'}>{t.accuracy.toFixed(1)}%</Badge>}
                      <Link href={`/app/practice/${encodeURIComponent(t.subject)}?timed=30&paper=${paper}&topic=${encodeURIComponent(t.topic)}`}>
                        <Button size="sm">Practice Now</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* (6) Due revision */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Due revision</CardTitle>
            <CardDescription>Spaced-repetition items waiting for review.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4">
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{summary?.dueRevisionCount ?? 0}</p>
            <Link href="/app/revision"><Button>Start Revision <ArrowRight className="h-4 w-4" /></Button></Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
