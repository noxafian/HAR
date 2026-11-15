'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Clock, FileQuestion, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { apiRequest } from '@/lib/client/api'

interface MockTest { id: string; title: string; paper: 'CS' | 'DA'; duration_minutes: number; total_questions: number | null; total_marks: number | null; scheduled_at: string | null }
export default function MockTestsPage() {
  const [tests, setTests] = useState<MockTest[]>([])
  const [paper, setPaper] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  async function load(nextPaper = paper) {
    setLoading(true); setError('')
    try { const result = await apiRequest<{ items: MockTest[] }>('/api/v1/exams' + (nextPaper ? `?paper=${nextPaper}` : '')); setTests(result.items) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load mock tests') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load('') }, [])
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Mock Test Centre</h1><p className="mt-1 text-sm text-slate-500">Published, timed mock examinations for GATE CS and DA.</p></div><Select aria-label="Filter paper" value={paper} onChange={e => { setPaper(e.target.value); void load(e.target.value) }} className="w-40"><option value="">All papers</option><option value="CS">GATE CS</option><option value="DA">GATE DA</option></Select></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    {loading ? <div className="flex justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading published tests…</div> : tests.length === 0 ? <EmptyState icon={ClipboardList} title="No mock tests are currently published." description="Tests will appear here after an administrator publishes a complete question set. No sample or placeholder exams are shown."/> : <div className="grid gap-4 sm:grid-cols-2">{tests.map(test => <article key={test.id} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold text-slate-900 dark:text-slate-100">{test.title}</h2><Badge variant="outline">GATE {test.paper}</Badge></div><div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500"><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5"/>{test.duration_minutes} minutes</span>{test.total_questions !== null && <span className="flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5"/>{test.total_questions} questions</span>}{test.total_marks !== null && <span>{Number(test.total_marks)} marks</span>}</div>{test.scheduled_at && <p className="mt-2 text-xs text-slate-500">Scheduled: {new Date(test.scheduled_at).toLocaleString()}</p>}<Link href={`/app/mock-tests/${test.id}`} className="mt-5 inline-block"><Button>View and Start Test</Button></Link></article>)}</div>}
  </div>
}
