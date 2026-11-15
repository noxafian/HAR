'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowRight, BarChart2, BookOpen, CalendarDays, ClipboardList,
  Clock, FileText, Flame, Library, Loader2, Megaphone, MessageSquare, RotateCcw,
  Target, TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { apiRequest } from '@/lib/client/api'
import { useCountdown } from '@/hooks/use-countdown'
import { GATE_CS_DATE, GATE_DA_DATE, SPRINT_THRESHOLD_DAYS } from '@/lib/exam-dates'
import SprintBanner from '@/components/sprint/sprint-banner'

interface AnalyticsSummary {
  pyqAccuracy: number | null
  pyqAttempted: number
  mockTestsAttempted: number
  studyStreakDays: number
  totalStudyMinutes: number
  weeklyStudyMinutes: number
  revisionProgress: { tracked: number; reviewsRecorded: number; due: number; overdue: number; scheduled: number }
  mockTestHistory: { testId: string; attemptedAt: string; paper: string; totalMarks: number; maxPossibleMarks: number; accuracy: number }[]
  weakTopics: { topicId: string; topicName: string; accuracyPercent: number; attemptCount: number }[]
}
interface PlannerTask { id: string; title: string; scheduled_date: string; priority: string; estimated_mins: number | null; subject_name: string; completed: boolean }
interface RevisionItem { id: string; topic: string; subject: string; dueDate: string | null; status: string; intervalDays: number }
interface MockTest { id: string; title: string; paper: string; duration_minutes: number; total_questions: number | null; total_marks: number | null; scheduled_at: string | null }
interface Resource { id: string; title: string; paper: string | null; file_type: string; status: string }
interface Announcement { id: string; title: string; body: string; author_name: string; created_at: string; is_pinned: boolean }
interface Discussion { id: string; title: string; category: string; reply_count: number; author_name: string; created_at: string }
interface DashboardState {
  analytics: AnalyticsSummary | null
  tasks: PlannerTask[] | null
  revisions: RevisionItem[] | null
  tests: MockTest[] | null
  resources: Resource[] | null
  announcements: Announcement[] | null
  discussions: Discussion[] | null
}

// Official GATE 2027 exam dates are centralized in src/lib/exam-dates.ts.
// GATE_CS_DATE / GATE_DA_DATE / SPRINT_THRESHOLD_DAYS are imported above.

function localDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
function dateLabel(value: string | null) {
  if (!value) return 'Available now'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date not set' : date.toLocaleString()
}

function Panel({ title, description, href, children, icon: Icon, highlight }: { title: string; description?: string; href: string; children: React.ReactNode; icon: React.ElementType; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'h-full ring-2 ring-indigo-200 dark:ring-indigo-800' : 'h-full'}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Icon className="h-4 w-4 text-indigo-500"/>{title}
          </CardTitle>
          <Link href={href} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">View all <ArrowRight className="inline h-3 w-3"/></Link>
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-400 italic">{children}</p>
}

function StatPill({ icon: Icon, label, value, loading }: { icon: React.ElementType; label: string; value: string; loading: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <Icon className="h-4 w-4 text-indigo-500" />
      <span className="text-xs text-slate-500">{label}:</span>
      {loading ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" /> : <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{value}</span>}
    </div>
  )
}

function SectionHeader({ icon, title, description }: { icon: string; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-3 border-l-4 border-indigo-500 pl-3">
      <span className="text-lg">{icon}</span>
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
    </div>
  )
}

function TodayGoalCard({ analytics, loading }: { analytics: AnalyticsSummary | null; loading: boolean }) {
  const DAILY_GOAL_MINS = 120
  // No per-day focus API exists; use weekly average as approximation
  const todayEstimate = analytics ? Math.round(analytics.weeklyStudyMinutes / 7) : 0
  const progress = Math.min(100, Math.round((todayEstimate / DAILY_GOAL_MINS) * 100))
  const streak = analytics?.studyStreakDays ?? 0
  const hasActivity = (analytics?.weeklyStudyMinutes ?? 0) > 0

  // Build last-7-day heatmap labels (Mon–Sun relative to today)
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - 6 + i)
    return { label: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2), isToday: i === 6 }
  })

  return (
    <Card className="w-full border-indigo-200 bg-gradient-to-br from-indigo-50 to-white dark:border-indigo-800 dark:from-indigo-950/40 dark:to-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-indigo-800 dark:text-indigo-200">
          <Target className="h-4 w-4 text-indigo-500" />
          Today's Study Goal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
          {/* Progress section */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>
                {loading ? 'Calculating…' : `~${todayEstimate} / ${DAILY_GOAL_MINS} min studied today`}
              </span>
              <span className="font-semibold text-indigo-700 dark:text-indigo-300">{loading ? '…' : `${progress}%`}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${loading ? 0 : progress}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 italic">~daily estimate from weekly average · use Focus Timer for exact tracking</p>
          </div>

          {/* Streak */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            <div>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {loading ? '—' : `${streak}`}
              </p>
              <p className="text-xs text-slate-500">day streak</p>
            </div>
          </div>

          {/* 7-day heatmap */}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Last 7 days</p>
            <div className="flex gap-1">
              {days.map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <div
                    className={`h-6 w-6 rounded-sm ${
                      day.isToday && hasActivity
                        ? 'bg-indigo-500'
                        : day.isToday
                        ? 'bg-indigo-200 dark:bg-indigo-800'
                        : hasActivity && i >= 7 - Math.min(streak, 7)
                        ? 'bg-indigo-500'
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                    title={day.label}
                  />
                  <span className="text-[9px] text-slate-400">{day.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 italic">Daily breakdown needs Focus Timer</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function HeroCountdownBlock({ label, date }: { label: string; date: Date | null }) {
  const result = useCountdown(date)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{label}</p>
      {!result.configured ? (
        <p className="text-xs text-indigo-400 italic">Official schedule not configured.</p>
      ) : result.isPast ? (
        <p className="text-xs text-indigo-400">Examination date has passed.</p>
      ) : (
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <span className="font-mono text-3xl font-bold text-indigo-700 dark:text-indigo-300">{result.days}</span>
            <span className="text-[10px] uppercase tracking-wide text-indigo-500">days</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-mono text-2xl font-bold text-indigo-700 dark:text-indigo-300">{String(result.hours).padStart(2, '0')}</span>
            <span className="text-[10px] uppercase tracking-wide text-indigo-500">hrs</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-mono text-2xl font-bold text-indigo-700 dark:text-indigo-300">{String(result.minutes).padStart(2, '0')}</span>
            <span className="text-[10px] uppercase tracking-wide text-indigo-500">min</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-mono text-2xl font-bold text-indigo-700 dark:text-indigo-300">{String(result.seconds).padStart(2, '0')}</span>
            <span className="text-[10px] uppercase tracking-wide text-indigo-500">sec</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardState>({ analytics: null, tasks: null, revisions: null, tests: null, resources: null, announcements: null, discussions: null })
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    let active = true
    const today = localDate()
    const load = async <T,>(path: string, key: keyof DashboardState): Promise<[keyof DashboardState, T | null, string | null]> => {
      try { return [key, await apiRequest<T>(path), null] }
      catch (error) { return [key, null, error instanceof Error ? error.message : `Could not load ${key}`] }
    }
    void Promise.all([
      load<AnalyticsSummary>('/api/v1/analytics/summary', 'analytics'),
      load<{ items: PlannerTask[] }>(`/api/v1/planner/tasks?from=${today}&to=${today}&completed=false`, 'tasks'),
      load<{ items: RevisionItem[] }>('/api/v1/revision/items', 'revisions'),
      load<{ items: MockTest[] }>('/api/v1/exams', 'tests'),
      load<{ items: Resource[] }>('/api/v1/library?limit=5', 'resources'),
      load<{ items: Announcement[] }>('/api/v1/community/announcements', 'announcements'),
      load<{ items: Discussion[] }>('/api/v1/community/discussions?limit=5', 'discussions'),
    ]).then(results => {
      if (!active) return
      const next: DashboardState = { analytics: null, tasks: null, revisions: null, tests: null, resources: null, announcements: null, discussions: null }
      const nextErrors: string[] = []
      for (const [key, value, error] of results) {
        if (key === 'analytics') next.analytics = value as AnalyticsSummary | null
        else if (key === 'tasks') next.tasks = (value as { items: PlannerTask[] } | null)?.items ?? null
        else if (key === 'revisions') next.revisions = (value as { items: RevisionItem[] } | null)?.items ?? null
        else if (key === 'tests') next.tests = (value as { items: MockTest[] } | null)?.items ?? null
        else if (key === 'resources') next.resources = (value as { items: Resource[] } | null)?.items ?? null
        else if (key === 'announcements') next.announcements = (value as { items: Announcement[] } | null)?.items ?? null
        else if (key === 'discussions') next.discussions = (value as { items: Discussion[] } | null)?.items ?? null
        if (error) nextErrors.push(`${key}: ${error}`)
      }
      setData(next)
      setErrors(nextErrors)
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const dueItems = (data.revisions ?? []).filter(item => item.status === 'due' || item.status === 'overdue').slice(0, 4)
  const upcomingTests = (data.tests ?? []).filter(test => !test.scheduled_at || new Date(test.scheduled_at).getTime() >= Date.now()).slice(0, 4)
  const formatMinutes = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Your preparation overview, using your saved StudyHub activity.</p>
        </div>
        <Link href="/app/planner" className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
          <CalendarDays className="h-4 w-4"/>Open planner
        </Link>
      </div>

      {/* Errors banner */}
      {errors.length > 0 && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          Some dashboard sections could not be loaded: {errors.join(' · ')}
        </div>
      )}

      {/* Hero: GATE Countdown */}
      <Card className="w-full border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h2 className="text-xl font-bold text-indigo-900 dark:text-indigo-100">GATE 2027 Countdown</h2>
                <p className="text-sm text-indigo-600 dark:text-indigo-400">Time remaining until GATE 2027</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-8">
              <HeroCountdownBlock label="GATE CS 2027" date={GATE_CS_DATE} />
              <HeroCountdownBlock label="GATE DA 2027" date={GATE_DA_DATE} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sprint banner — only visible within the last-month window */}
      <SprintBanner />

      {/* Quick stats pills row */}
      <div className="flex flex-wrap gap-3">
        <StatPill icon={Clock} label="This week" value={formatMinutes(data.analytics?.weeklyStudyMinutes ?? 0)} loading={loading} />
        <StatPill icon={Flame} label="Streak" value={`${data.analytics?.studyStreakDays ?? 0} days`} loading={loading} />
        <StatPill icon={Target} label="PYQ accuracy" value={data.analytics?.pyqAccuracy == null ? '—' : `${data.analytics.pyqAccuracy.toFixed(1)}%`} loading={loading} />
      </div>

      {/* Today's Study Goal card */}
      <TodayGoalCard analytics={data.analytics} loading={loading} />

      {/* Section: Today */}
      <SectionHeader icon="📅" title="Today" description="Your tasks and revision due today" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Today's study targets" description="Tasks scheduled for today" href="/app/planner" icon={Target} highlight>
          {loading && !data.tasks ? <Empty>Loading tasks…</Empty> : !data.tasks?.length ? <Empty>No unfinished tasks are scheduled for today.</Empty> : (
            <div className="space-y-3">
              {data.tasks.slice(0, 5).map(task => (
                <div key={task.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-slate-500">{task.subject_name}{task.estimated_mins ? ` · ${task.estimated_mins} min` : ''}</p>
                  </div>
                  <Badge variant={task.priority === 'high' ? 'destructive' : 'outline'}>{task.priority}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Pending revision" description="Due today and overdue items" href="/app/revision" icon={RotateCcw} highlight>
          {loading && !data.revisions ? <Empty>Loading revision schedule…</Empty> : dueItems.length === 0 ? <Empty>No revision items are due today or overdue.</Empty> : (
            <div className="space-y-3">
              {dueItems.map(item => (
                <div key={item.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.topic}</p>
                    <p className="text-xs text-slate-500">{item.subject} · {dateLabel(item.dueDate)}</p>
                  </div>
                  <Badge variant={item.status === 'overdue' ? 'destructive' : 'warning'}>{item.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Section: Exams */}
      <SectionHeader icon="📝" title="Exams" description="Available mock tests" />
      <div className="lg:max-w-[66%]">
        <Panel title="Mock tests" description="Published tests available to take" href="/app/mock-tests" icon={ClipboardList}>
          {loading && !data.tests ? <Empty>Loading tests…</Empty> : upcomingTests.length === 0 ? <Empty>No published mock tests are currently available.</Empty> : (
            <div className="space-y-3">
              {upcomingTests.map(test => (
                <Link key={test.id} href={`/app/mock-tests/${test.id}`} className="block rounded-md border border-slate-100 p-2 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
                  <div className="flex justify-between gap-2">
                    <p className="text-sm font-medium">{test.title}</p>
                    <Badge variant="outline">{test.paper}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{test.duration_minutes} min · {test.total_questions ?? '—'} questions · {dateLabel(test.scheduled_at)}</p>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Section: Study */}
      <SectionHeader icon="📚" title="Study" description="Recent resources and performance" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Recent study material" description="Verified shared resources and your submissions" href="/app/library" icon={Library}>
          {loading && !data.resources ? <Empty>Loading resources…</Empty> : !data.resources?.length ? <Empty>No resources are available yet.</Empty> : (
            <div className="space-y-3">
              {data.resources.map(resource => (
                <div key={resource.id} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-indigo-500"/>
                    <p className="truncate text-sm font-medium">{resource.title}</p>
                  </div>
                  <Badge variant={resource.status === 'verified' ? 'success' : 'warning'}>{resource.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Performance snapshot" description="Only recorded scores and activity" href="/app/analytics" icon={BarChart2}>
          {!data.analytics ? <Empty>{loading ? 'Loading analytics…' : 'No analytics data available.'}</Empty> : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Scored mock attempts</span><strong>{data.analytics.mockTestsAttempted}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Reviews recorded</span><strong>{data.analytics.revisionProgress.reviewsRecorded}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Revision items tracked</span><strong>{data.analytics.revisionProgress.tracked}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Study time (last year)</span><strong>{formatMinutes(data.analytics.totalStudyMinutes)}</strong></div>
              <Link href="/app/analytics" className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">Full analytics <TrendingUp className="h-3 w-3"/></Link>
            </div>
          )}
        </Panel>
        <Panel title="Topics needing attention" description="Lowest observed correctness rate" href="/app/analytics" icon={AlertTriangle}>
          {!data.analytics ? <Empty>{loading ? 'Loading attempt analysis…' : 'No attempt data available.'}</Empty> : data.analytics.weakTopics.length === 0 ? <Empty>No topic-level attempts are available yet.</Empty> : (
            <div className="space-y-3">
              {data.analytics.weakTopics.slice(0, 4).map(topic => (
                <div key={topic.topicId} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{topic.topicName}</p>
                    <p className="text-xs text-slate-500">{topic.attemptCount} attempts</p>
                  </div>
                  <Badge variant={topic.accuracyPercent < 50 ? 'destructive' : 'warning'}>{topic.accuracyPercent.toFixed(1)}%</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Section: Community */}
      <SectionHeader icon="💬" title="Community" description="Announcements and discussions" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Announcements" description="Current group notices" href="/app/community" icon={Megaphone}>
          {loading && !data.announcements ? <Empty>Loading announcements…</Empty> : !data.announcements?.length ? <Empty>No announcements have been published.</Empty> : (
            <div className="space-y-3">
              {data.announcements.slice(0, 3).map(item => (
                <div key={item.id} className="border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.body}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.author_name} · {new Date(item.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Community activity" description="Recent group discussions" href="/app/community" icon={MessageSquare}>
          {loading && !data.discussions ? <Empty>Loading discussions…</Empty> : !data.discussions?.length ? <Empty>No discussions have been started yet.</Empty> : (
            <div className="space-y-3">
              {data.discussions.slice(0, 4).map(item => (
                <Link key={item.id} href={`/app/community/discussions/${item.id}`} className="block border-b border-slate-100 pb-2 last:border-0 hover:text-indigo-600 dark:border-slate-800">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.author_name} · {item.reply_count} replies · {item.category.replaceAll('-', ' ')}</p>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
