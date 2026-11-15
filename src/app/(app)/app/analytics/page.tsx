'use client'

import { useEffect, useState } from 'react'
import { Target, TrendingUp, BarChart2, Clock, CheckCircle2, AlertTriangle, RotateCcw, BookOpen, ShieldCheck, Flame, Loader2, Layers } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { apiRequest } from '@/lib/client/api'

interface AnalyticsData {
  pyqAccuracy: number | null
  pyqAttempted: number
  mockTestsAttempted: number
  mockTestHistory: { testId: string; attemptedAt: string; paper: string; totalMarks: number; maxPossibleMarks: number; accuracy: number }[]
  subjectProgress: { subjectId: string; subjectName: string; topicsTotal: number; topicsCompleted: number; pyqAttempted: number; pyqAccuracy: number | null }[]
  weakTopics: { topicId: string; topicName: string; subjectId: string; accuracyPercent: number; attemptCount: number }[]
  mistakeBreakdown: Record<string, number>
  mistakesLogged: number
  flashcardsCreated: number
  studyStreakDays: number
  totalStudyMinutes: number
  weeklyStudyMinutes: number
  revisionProgress: { tracked: number; reviewsRecorded: number; due: number; overdue: number; scheduled: number }
  lastUpdated: string
}

function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: React.ElementType }) {
  return <Card><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">{label}</span><Icon className="h-4 w-4 text-indigo-500"/></div><p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></CardContent></Card>
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    apiRequest<AnalyticsData>('/api/v1/analytics/summary')
      .then(result => { if (active) setData(result) })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Analytics could not be loaded') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const minutes = data?.totalStudyMinutes ?? 0
  const weekly = data?.weeklyStudyMinutes ?? 0
  const formatMinutes = (value: number) => `${Math.floor(value / 60)}h ${value % 60}m`

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Performance Analytics</h1><p className="mt-1 text-sm text-slate-500">Metrics calculated from your persisted exam attempts, revisions and study sessions.</p></div>
    <Alert variant="warning" title="Preparation metrics, not rank prediction">These indicators describe recorded activity. They do not predict an All India Rank, guarantee an exam score, or infer performance from missing data.</Alert>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
    {loading ? <div className="flex justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Calculating your recorded metrics…</div> : data && <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="PYQ accuracy" value={data.pyqAccuracy === null ? '—' : `${data.pyqAccuracy.toFixed(1)}%`} note={`${data.pyqAttempted} recorded PYQ attempts`} icon={BookOpen}/>
        <Metric label="Mock tests completed" value={String(data.mockTestsAttempted)} note="Scored attempts in your history" icon={BarChart2}/>
        <Metric label="Study time this week" value={formatMinutes(weekly)} note="Recorded focus sessions · last 7 days" icon={Clock}/>
        <Metric label="Study streak" value={`${data.studyStreakDays} days`} note="Based on recorded focus sessions" icon={Flame}/>
        <Metric label="Total study time" value={formatMinutes(minutes)} note="Recorded sessions · last 365 days" icon={Target}/>
        <Metric label="Flashcards created" value={String(data.flashcardsCreated)} note="Cards saved to your deck" icon={Layers}/>
        <Metric label="Mistakes logged" value={String(data.mistakesLogged)} note="Entries in your mistake notebook" icon={AlertTriangle}/>
        <Metric label="Revision topics tracked" value={String(data.revisionProgress.tracked)} note={`${data.revisionProgress.due} due · ${data.revisionProgress.overdue} overdue`} icon={RotateCcw}/>
      </div>

      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-emerald-600"/>Revision progress</CardTitle><CardDescription>Based on revision records you have created—not assumed completion of the full official syllabus.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-4"><div><p className="text-2xl font-bold">{data.revisionProgress.tracked}</p><p className="text-xs text-slate-500">Tracked items</p></div><div><p className="text-2xl font-bold">{data.revisionProgress.reviewsRecorded}</p><p className="text-xs text-slate-500">Reviews recorded</p></div><div><p className="text-2xl font-bold">{data.revisionProgress.due}</p><p className="text-xs text-slate-500">Due today</p></div><div><p className="text-2xl font-bold">{data.revisionProgress.overdue}</p><p className="text-xs text-slate-500">Overdue</p></div></CardContent></Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-indigo-500"/>Subject activity</CardTitle><CardDescription>Recorded attempts grouped by subject; topic review coverage counts only canonical topics with recorded reviews.</CardDescription></CardHeader><CardContent>{data.subjectProgress.length === 0 ? <p className="text-sm text-slate-500">No subject catalogue or attempt data is available yet.</p> : <div className="space-y-3">{data.subjectProgress.map(item => <div key={item.subjectId} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800"><div><p className="text-sm font-medium">{item.subjectName}</p><p className="text-xs text-slate-500">{item.topicsCompleted}/{item.topicsTotal} canonical topics marked complete · {item.pyqAttempted} question attempts</p></div><Badge variant="outline">{item.pyqAccuracy === null ? 'No accuracy yet' : `${item.pyqAccuracy.toFixed(1)}% accuracy`}</Badge></div>)}</div>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-rose-500"/>Topics needing attention</CardTitle><CardDescription>Topics with the lowest observed correctness rate, requiring at least one recorded attempt.</CardDescription></CardHeader><CardContent>{data.weakTopics.length === 0 ? <p className="text-sm text-slate-500">No topic-level performance data is available yet.</p> : <div className="space-y-3">{data.weakTopics.map(item => <div key={item.topicId} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800"><div><p className="text-sm font-medium">{item.topicName}</p><p className="text-xs text-slate-500">{item.attemptCount} attempts</p></div><Badge variant={item.accuracyPercent < 50 ? 'destructive' : 'warning'}>{item.accuracyPercent.toFixed(1)}% correct</Badge></div>)}</div>}</CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-indigo-500"/>Mistake classification</CardTitle></CardHeader><CardContent>{Object.entries(data.mistakeBreakdown).every(([, count]) => count === 0) ? <p className="text-sm text-slate-500">No mistakes have been logged yet.</p> : <div className="space-y-2">{Object.entries(data.mistakeBreakdown).filter(([, count]) => count > 0).map(([category, count]) => <div key={category} className="flex justify-between gap-3 text-sm"><span className="capitalize text-slate-600 dark:text-slate-300">{category.replaceAll('-', ' ')}</span><span className="font-semibold">{count}</span></div>)}</div>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Recent mock-test history</CardTitle></CardHeader><CardContent>{data.mockTestHistory.length === 0 ? <p className="text-sm text-slate-500">No scored mock-test attempts yet.</p> : <div className="space-y-3">{data.mockTestHistory.slice(0, 8).map(item => <div key={item.testId} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800"><div><p className="text-sm font-medium">GATE {item.paper}</p><p className="text-xs text-slate-500">{new Date(item.attemptedAt).toLocaleString()}</p></div><div className="text-right"><p className="text-sm font-semibold">{Number(item.totalMarks).toFixed(2)} / {Number(item.maxPossibleMarks).toFixed(2)}</p><p className="text-xs text-slate-500">{Number(item.accuracy).toFixed(1)}% accuracy</p></div></div>)}</div>}</CardContent></Card>
      </div>
      <p className="text-right text-xs text-slate-400">Updated {new Date(data.lastUpdated).toLocaleString()} · Exam history limited to latest 500 results; focus history limited to 365 days.</p>
    </>}
  </div>
}

