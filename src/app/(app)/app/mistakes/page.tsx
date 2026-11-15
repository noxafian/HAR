'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Filter, Trash2, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { apiRequest, jsonBody } from '@/lib/client/api'
import type { MistakeCategory } from '@/types/revision'

const MISTAKE_CATEGORIES: { id: MistakeCategory; label: string; color: 'destructive' | 'warning' | 'default' | 'secondary' }[] = [
  { id: 'conceptual-misunderstanding', label: 'Conceptual Misunderstanding', color: 'destructive' },
  { id: 'calculation-error', label: 'Calculation Error', color: 'warning' },
  { id: 'formula-forgotten', label: 'Formula Forgotten', color: 'secondary' },
  { id: 'question-misunderstood', label: 'Question Misunderstood', color: 'warning' },
  { id: 'time-management', label: 'Time Management', color: 'default' },
  { id: 'incorrect-guessing', label: 'Incorrect Guessing', color: 'destructive' },
]
interface MistakeEntry { 
  id: string
  subject_name: string
  topic_name: string
  category: MistakeCategory
  question_text: string
  my_answer: string
  your_answer?: string
  correct_answer: string
  explanation?: string
  notes: string | null
  resolved: boolean
  created_at: string
  source_type?: string
  source_ref?: string
}

export default function MistakesPage() {
  const [filterCategory, setFilterCategory] = useState('')
  const [mistakes, setMistakes] = useState<MistakeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadMistakes() {
    setLoading(true); setError('')
    try { const result = await apiRequest<{ items: MistakeEntry[] }>('/api/v1/revision/mistakes?limit=100'); setMistakes(result.items) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load mistakes') }
    finally { setLoading(false) }
  }
  useEffect(() => { void loadMistakes() }, [])
  async function handleDelete(id: string) {
    setError('')
    try { await apiRequest(`/api/v1/revision/mistakes/${id}`, { method: 'DELETE' }); setMistakes(prev => prev.filter(m => m.id !== id)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete mistake') }
  }
  async function toggleResolved(entry: MistakeEntry) {
    try { await apiRequest(`/api/v1/revision/mistakes/${entry.id}`, { method: 'PATCH', body: jsonBody({ resolved: !entry.resolved }) }); setMistakes(prev => prev.map(m => m.id === entry.id ? { ...m, resolved: !m.resolved } : m)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update mistake') }
  }
  const filtered = useMemo(() => filterCategory ? mistakes.filter(m => m.category === filterCategory) : mistakes, [mistakes, filterCategory])

  function getSourceTypeVariant(sourceType?: string): 'default' | 'secondary' | 'warning' {
    if (!sourceType || sourceType === 'manual') return 'secondary'
    if (sourceType === 'topic_quiz') return 'default'
    if (sourceType === 'mock_test') return 'warning'
    return 'secondary'
  }

  function getSourceTypeLabel(sourceType?: string): string {
    if (!sourceType || sourceType === 'manual') return 'Manual'
    if (sourceType === 'topic_quiz') return 'Topic Quiz'
    if (sourceType === 'mock_test') return 'Mock Test'
    return 'Unknown'
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Mistake Notebook</h1><p className="mt-1 text-sm text-slate-500">Review mistakes automatically logged from quizzes and tests.</p></div></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-slate-400"/><Label htmlFor="category-filter" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Filter by taxonomy</Label></div><Select id="category-filter" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="h-9 min-w-56 text-xs"><option value="">All Categories ({mistakes.length})</option>{MISTAKE_CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.label} ({mistakes.filter(m => m.category === cat.id).length})</option>)}</Select></div>
    {loading ? <div className="flex justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading notebook…</div> : filtered.length === 0 ? <EmptyState icon={AlertCircle} title={mistakes.length === 0 ? 'No mistakes recorded yet.' : 'No mistakes matching this filter.'} description="Mistakes from quizzes and mock tests will be automatically logged here." /> : <div className="grid gap-4 sm:grid-cols-2">{filtered.map(entry => { const catMeta = MISTAKE_CATEGORIES.find(c => c.id === entry.category); return <div key={entry.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div><div className="mb-2 flex items-start justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><Badge variant={catMeta?.color || 'default'}>{catMeta?.label}</Badge><Badge variant={getSourceTypeVariant(entry.source_type)}>{getSourceTypeLabel(entry.source_type)}</Badge></div><span className="text-xs text-slate-400">{new Date(entry.created_at).toLocaleDateString()}</span></div><div className="mb-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">{entry.subject_name} · {entry.topic_name}</div><p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{entry.question_text}</p>{(entry.your_answer || entry.my_answer) && <p className="mb-1 text-xs text-rose-600 dark:text-rose-300">Your answer: {entry.your_answer || entry.my_answer}</p>}{entry.correct_answer && <p className="mb-2 text-xs text-emerald-700 dark:text-emerald-300">Correct answer: {entry.correct_answer}</p>}{entry.explanation && <div className="mb-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-950/30 dark:text-blue-300"><span className="font-semibold">Explanation: </span>{entry.explanation}</div>}{entry.notes && <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"><span className="font-semibold">Notes: </span>{entry.notes}</div>}</div><div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800"><Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => void toggleResolved(entry)}>{entry.resolved ? <><CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600"/>Resolved</> : 'Mark resolved'}</Button><Button variant="ghost" size="sm" className="h-8 text-xs text-rose-500" onClick={() => void handleDelete(entry.id)}><Trash2 className="mr-1 h-3.5 w-3.5"/>Remove</Button></div></div> })}</div>}
  </div>
}
