'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { apiRequest } from '@/lib/client/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { PlatformAnalytics, SubjectQuestionCount, DailySignup } from '@/types/admin-analytics'

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value.toLocaleString()}</p>
    </Card>
  )
}

function CssBarChart({ items, maxLabel }: { items: { label: string; count: number }[]; maxLabel?: string }) {
  const maxCount = Math.max(...items.map(i => i.count), 1)
  return (
    <div className="space-y-2">
      {maxLabel && <p className="text-xs text-muted-foreground">Max: {maxCount.toLocaleString()} {maxLabel}</p>}
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="w-36 shrink-0 truncate text-xs text-right text-muted-foreground" title={item.label}>{item.label}</span>
          <div className="flex-1 rounded bg-slate-100 dark:bg-slate-800 h-5">
            <div
              className="h-5 bg-indigo-500 rounded transition-all"
              style={{ width: `${(item.count / maxCount) * 100}%` }}
              aria-label={`${item.label}: ${item.count}`}
            />
          </div>
          <span className="w-12 text-xs font-medium">{item.count}</span>
        </div>
      ))}
    </div>
  )
}

function DailySignupsChart({ data }: { data: DailySignup[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-0.5 h-24 mt-2">
      {data.map((day, i) => {
        const showLabel = i % 5 === 0
        return (
          <div key={day.date} className="flex flex-col items-center flex-1 min-w-0" title={`${day.date}: ${day.count}`}>
            <div
              className="w-full bg-blue-500 rounded-t transition-all"
              style={{ height: `${(day.count / maxCount) * 80}px` }}
            />
            {showLabel && <span className="text-[9px] text-muted-foreground mt-0.5 truncate w-full text-center">{day.date.slice(5)}</span>}
          </div>
        )
      })}
    </div>
  )
}

export function AdminPlatformAnalyticsClient() {
  const [data, setData] = useState<PlatformAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiRequest<PlatformAnalytics>('/api/v1/admin/platform-analytics')
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const subjectChartItems: { label: string; count: number }[] = (data?.questions_by_subject ?? []).map((s: SubjectQuestionCount) => ({
    label: s.subject_name,
    count: s.count,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Platform Analytics</h1>
          <p className="mt-1 text-muted-foreground">Usage metrics and engagement data.</p>
        </div>
        <Button variant="outline" size="sm" isLoading={loading} onClick={load}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {error && <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}

      {loading && !data && <div className="p-6 text-sm text-muted-foreground">Loading analytics…</div>}

      {data && (
        <>
          {/* Key stats */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Users" value={data.total_users} />
            <StatCard label="Active (7 days)" value={data.active_last_7_days} />
            <StatCard label="Active (30 days)" value={data.active_last_30_days} />
            <StatCard label="Total Questions" value={data.total_questions} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Verified Questions" value={data.published_questions} />
            <StatCard label="Total Mock Tests" value={data.total_mock_tests} />
            <StatCard label="Published Mock Tests" value={data.published_mock_tests} />
            <StatCard label="Exam Attempts" value={data.total_mock_attempts} />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Top 5 active users */}
            <Card className="p-5">
              <h2 className="mb-4 font-semibold">Top 5 Active Users</h2>
              {data.top_5_active_users.length === 0 && <p className="text-sm text-muted-foreground">No exam attempts yet.</p>}
              <ol className="space-y-2">
                {data.top_5_active_users.map((u, i) => (
                  <li key={u.user_id} className="flex items-center gap-3 text-sm">
                    <span className="w-5 text-muted-foreground font-medium">{i + 1}.</span>
                    <span className="flex-1 font-medium">{u.display_name}</span>
                    <span className="text-muted-foreground">{u.attempt_count} attempts</span>
                  </li>
                ))}
              </ol>
            </Card>

            {/* Daily signups */}
            <Card className="p-5">
              <h2 className="mb-4 font-semibold">Daily Signups (last 30 days)</h2>
              {data.daily_signups_last_30_days.length === 0 && <p className="text-sm text-muted-foreground">No signup data yet.</p>}
              {data.daily_signups_last_30_days.length > 0 && (
                <DailySignupsChart data={data.daily_signups_last_30_days} />
              )}
            </Card>
          </div>

          {/* Questions by subject */}
          <Card className="p-5">
            <h2 className="mb-4 font-semibold">Questions by Subject</h2>
            {subjectChartItems.length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}
            {subjectChartItems.length > 0 && <CssBarChart items={subjectChartItems} maxLabel="questions" />}
          </Card>
        </>
      )}
    </div>
  )
}
