'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CS_SUBJECTS, DA_SUBJECTS } from '@/lib/constants'
import { apiRequest, jsonBody } from '@/lib/client/api'

type Paper = 'CS' | 'DA'
interface GeneratedTask {
  title: string
  subject_name: string
  priority: 'high' | 'medium'
  scheduled_date: string
  weekLabel: string
}

const EXAM_OPTIONS: { paper: Paper; label: string; date: string }[] = [
  { paper: 'CS', label: 'CS — Feb 7, 2027', date: '2027-02-07' },
  { paper: 'DA', label: 'DA — Feb 15, 2027', date: '2027-02-15' },
]

/** Returns the Sunday of the week that starts on the given Monday. */
function sundayOfWeek(monday: Date): string {
  const d = new Date(monday)
  d.setDate(d.getDate() + 6)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Returns next upcoming Monday (today if today is Monday). */
function nextMonday(from: Date = new Date()): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  const dayOfWeek = d.getDay() // 0=Sun, 1=Mon
  const daysUntilMonday = dayOfWeek === 1 ? 0 : dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  d.setDate(d.getDate() + daysUntilMonday)
  return d
}

/** Advance date by N weeks in-place. */
function addWeeks(d: Date, weeks: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + weeks * 7)
  return result
}

function generatePlan(
  paper: Paper,
  examDate: string,
  hoursPerDay: number,
  weakSubjectIds: string[],
): GeneratedTask[] {
  const subjects = paper === 'CS' ? CS_SUBJECTS : DA_SUBJECTS
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exam = new Date(`${examDate}T00:00:00`)
  const daysRemaining = Math.max(1, Math.round((exam.getTime() - today.getTime()) / 86400000))
  const weeksAvailable = Math.max(1, Math.floor(daysRemaining / 7))

  // Allocate subject weights: weak subjects get 1.5x
  const totalWeight = subjects.reduce((sum, s) => sum + (weakSubjectIds.includes(s.id) ? 1.5 : 1), 0)
  const totalHours = weeksAvailable * hoursPerDay * 7
  const tasks: GeneratedTask[] = []

  let currentMonday = nextMonday(today)
  let weekIndex = 0

  for (const subject of subjects) {
    const weight = weakSubjectIds.includes(subject.id) ? 1.5 : 1
    const allocatedWeeks = Math.max(1, Math.round((weight / totalWeight) * weeksAvailable))

    for (let w = 0; w < allocatedWeeks; w++) {
      if (weekIndex >= weeksAvailable) break
      const scheduledDate = sundayOfWeek(currentMonday)
      const weekLabel = `Week ${weekIndex + 1} (${scheduledDate})`
      tasks.push({
        title: `Study ${subject.name}`,
        subject_name: subject.name,
        priority: weakSubjectIds.includes(subject.id) ? 'high' : 'medium',
        scheduled_date: scheduledDate,
        weekLabel,
      })
      currentMonday = addWeeks(currentMonday, 1)
      weekIndex++
    }
    if (weekIndex >= weeksAvailable) break
  }

  // suppress lint warning about unused variable
  void totalHours

  return tasks
}

export default function GeneratePlanPage() {
  const [paper, setPaper] = useState<Paper>('CS')
  const [hoursPerDay, setHoursPerDay] = useState(4)
  const [weakSubjectIds, setWeakSubjectIds] = useState<string[]>([])
  const [preview, setPreview] = useState<GeneratedTask[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [saveProgress, setSaveProgress] = useState({ done: 0, total: 0 })

  const subjects = paper === 'CS' ? CS_SUBJECTS : DA_SUBJECTS
  const examOption = EXAM_OPTIONS.find(o => o.paper === paper)!

  function toggleSubject(id: string) {
    setWeakSubjectIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  function handleGenerate() {
    setError('')
    setSaved(false)
    setPreview(null)
    const tasks = generatePlan(paper, examOption.date, hoursPerDay, weakSubjectIds)
    setPreview(tasks)
  }

  async function handleSave() {
    if (!preview || preview.length === 0) return
    setSaving(true); setError(''); setSaveProgress({ done: 0, total: preview.length })
    let done = 0
    try {
      for (const task of preview) {
        await apiRequest('/api/v1/planner/tasks', {
          method: 'POST',
          body: jsonBody({
            title: task.title,
            subject: task.subject_name,
            scheduledDate: task.scheduled_date,
            priority: task.priority,
          }),
        })
        done++
        setSaveProgress({ done, total: preview.length })
      }
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save tasks')
    } finally {
      setSaving(false)
    }
  }

  // Group preview tasks by week
  const tasksByWeek = preview
    ? preview.reduce<Record<string, GeneratedTask[]>>((acc, t) => {
        const key = t.weekLabel
        if (!acc[key]) acc[key] = []
        acc[key].push(t)
        return acc
      }, {})
    : {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/app/planner" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline dark:text-indigo-400">
          <ArrowLeft className="h-4 w-4" />Back to Planner
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Generate Study Plan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Generate a rule-based weekly plan from today to your exam date and save it to the planner.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Plan Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Exam selector */}
          <div className="space-y-2">
            <Label>Exam</Label>
            <div className="flex flex-wrap gap-3">
              {EXAM_OPTIONS.map(opt => (
                <label key={opt.paper} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="paper"
                    value={opt.paper}
                    checked={paper === opt.paper}
                    onChange={() => { setPaper(opt.paper); setWeakSubjectIds([]); setPreview(null); setSaved(false) }}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Hours per day */}
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="hours-per-day">Hours per day</Label>
            <Input
              id="hours-per-day"
              type="number"
              min={1}
              max={12}
              value={hoursPerDay}
              onChange={e => setHoursPerDay(Math.min(12, Math.max(1, Number(e.target.value))))}
            />
          </div>

          {/* Weak subjects */}
          <div className="space-y-2">
            <Label>Weak subjects <span className="text-xs font-normal text-slate-400">(get 1.5× time allocation)</span></Label>
            <div className="flex flex-wrap gap-2">
              {subjects.map(s => (
                <label key={s.id} className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={weakSubjectIds.includes(s.id)}
                    onChange={() => toggleSubject(s.id)}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={saving}>
            <CalendarDays className="mr-1.5 h-4 w-4" />
            Generate Plan
          </Button>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview && preview.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Plan Preview — {preview.length} task{preview.length !== 1 ? 's' : ''}
            </h2>
            {saved ? (
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Saved! <Link href="/app/planner" className="underline">Open Planner →</Link>
              </div>
            ) : (
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving
                  ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving {saveProgress.done}/{saveProgress.total}…</>
                  : 'Save Plan'}
              </Button>
            )}
          </div>

          {Object.entries(tasksByWeek).map(([weekLabel, weekTasks]) => (
            <div key={weekLabel}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{weekLabel}</p>
              <div className="space-y-1.5">
                {weekTasks.map((task, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{task.title}</p>
                      <p className="text-xs text-slate-500">{task.subject_name} · {task.scheduled_date}</p>
                    </div>
                    <Badge variant={task.priority === 'high' ? 'destructive' : 'warning'}>
                      {task.priority === 'high' ? 'High' : 'Medium'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!saved && (
            <div className="pt-2 text-right">
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving
                  ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving {saveProgress.done}/{saveProgress.total}…</>
                  : 'Save Plan'}
              </Button>
            </div>
          )}
        </div>
      )}

      {preview && preview.length === 0 && (
        <p className="text-sm text-slate-500">No weeks available between today and the exam date.</p>
      )}
    </div>
  )
}
