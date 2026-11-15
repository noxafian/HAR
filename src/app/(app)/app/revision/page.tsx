'use client'

import { useEffect, useState } from 'react'
import { RotateCcw, Plus, CheckCircle2, Clock, Calendar, AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { CS_SUBJECTS, DA_SUBJECTS } from '@/lib/constants'
import { apiRequest, jsonBody } from '@/lib/client/api'

interface RevisionTask {
  id: string
  subject: string
  topic: string
  dueDate: string | null
  intervalDays: number
  revision_count: number
  status: 'due' | 'overdue' | 'scheduled' | 'completed'
}
interface RevisionHistory { id: string; subject: string; topic_label: string; reviewed_at: string; interval_days: number; revision_number: number }
interface RevisionPayload { items: RevisionTask[]; history: RevisionHistory[] }

function dateLabel(value: string | null) {
  if (!value) return 'Not scheduled'
  const date = new Date(`${value}T00:00:00`)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === -1) return 'Yesterday'
  if (diff < -1) return `${Math.abs(diff)} days ago`
  if (diff === 1) return 'Tomorrow'
  return `In ${diff} days`
}

export default function RevisionPage() {
  const [items, setItems] = useState<RevisionTask[]>([])
  const [history, setHistory] = useState<RevisionHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [subject, setSubject] = useState('Algorithms')
  const [topic, setTopic] = useState('')
  const [interval, setInterval] = useState(7)

  async function loadItems() {
    setLoading(true); setError('')
    try {
      const revisionResult = await apiRequest<RevisionPayload>('/api/v1/revision/items')
      setItems(revisionResult.items)
      setHistory(revisionResult.history)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load revision data') }
    finally { setLoading(false) }
  }
  useEffect(() => { void loadItems() }, [])

  async function handleSchedule() {
    if (!topic.trim()) return
    setSaving(true); setError('')
    try {
      // Schedule the revision item
      await apiRequest('/api/v1/revision/items', { method: 'POST', body: jsonBody({ subject, topic: topic.trim(), intervalDays: interval }) })
      
      // Auto-generate flashcards for this topic in the background (non-blocking)
      apiRequest('/api/v1/study/generate', {
        method: 'POST',
        body: jsonBody({ type: 'flashcards', subject_id: subject.toLowerCase().replace(/\s+/g, '-'), subject_name: subject, topic: topic.trim(), count: 5 })
      }).then(async (result) => {
        const cards = (result as { items?: Array<{ front: string; back: string }> }).items ?? []
        await Promise.all(cards.map(card =>
          apiRequest('/api/v1/revision/flashcards', {
            method: 'POST',
            body: jsonBody({ front: card.front, back: card.back, subject, topic: topic.trim() })
          }).catch(() => { /* individual card save failure is non-fatal */ })
        ))
      }).catch(() => {
        console.info('[Revision] AI flashcard generation skipped (provider unavailable)')
      })

      setTopic(''); setScheduleOpen(false); await loadItems()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not schedule revision') }
    finally { setSaving(false) }
  }

  async function markCompleted(id: string) {
    setSaving(true); setError('')
    try { await apiRequest(`/api/v1/revision/items/${id}`, { method: 'PATCH' }); await loadItems() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not complete revision') }
    finally { setSaving(false) }
  }

  async function removeItem(id: string) {
    setSaving(true); setError('')
    try { await apiRequest(`/api/v1/revision/items/${id}`, { method: 'DELETE' }); await loadItems() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove revision') }
    finally { setSaving(false) }
  }

  const dueAndOverdue = items.filter(item => item.status === 'due' || item.status === 'overdue')
  const scheduled = items.filter(item => item.status === 'scheduled')

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Revision Centre</h1><p className="mt-1 text-sm text-slate-500">Persistent spaced-repetition schedule across your GATE CS and DA preparation.</p></div><Button onClick={() => setScheduleOpen(true)}><Plus className="mr-1.5 h-4 w-4"/>Schedule Revision</Button></div>
    <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300">
      Browse the GATE syllabus and mark topics complete from the{' '}
      <a href="/app/exams/cs-2027" className="font-medium underline">GATE CS workspace</a> or{' '}
      <a href="/app/exams/da-2027" className="font-medium underline">GATE DA workspace</a>.
    </div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
    {loading ? <div className="flex justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading saved revisions…</div> : <Tabs defaultValue="due">
      <TabsList><TabsTrigger value="due">Due & Overdue ({dueAndOverdue.length})</TabsTrigger><TabsTrigger value="scheduled">Scheduled ({scheduled.length})</TabsTrigger><TabsTrigger value="history">History ({history.length})</TabsTrigger></TabsList>
      <TabsContent value="due">{dueAndOverdue.length === 0 ? <EmptyState icon={RotateCcw} title="No revisions are due." description="Schedule a topic or continue your current study plan." action={{ label: 'Schedule a topic', onClick: () => setScheduleOpen(true) }}/> : <div className="space-y-3">{dueAndOverdue.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.status === 'overdue' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'}`}>{item.status === 'overdue' ? <AlertTriangle className="h-5 w-5"/> : <Clock className="h-5 w-5"/>}</div><div><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.topic}</p><p className="text-xs text-slate-500">{item.subject} · {item.intervalDays}-day interval · Due {dateLabel(item.dueDate)}</p></div></div><div className="flex items-center gap-2"><Badge variant={item.status === 'overdue' ? 'destructive' : 'warning'}>{item.status === 'overdue' ? 'Overdue' : 'Due today'}</Badge><Button size="sm" disabled={saving} onClick={() => void markCompleted(item.id)}><CheckCircle2 className="mr-1.5 h-4 w-4"/>Reviewed</Button></div></div>)}</div>}</TabsContent>
      <TabsContent value="scheduled">{scheduled.length === 0 ? <EmptyState icon={Calendar} title="No future revisions scheduled." description="Add a topic to begin a review cycle."/> : <div className="space-y-3">{scheduled.map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.topic}</p><p className="text-xs text-slate-500">{item.subject} · {item.intervalDays}-day interval · {dateLabel(item.dueDate)}</p></div><div className="flex items-center gap-2"><Badge variant="outline">Scheduled</Badge><Button variant="ghost" size="icon" disabled={saving} onClick={() => void removeItem(item.id)} aria-label="Remove revision"><Trash2 className="h-4 w-4"/></Button></div></div>)}</div>}</TabsContent>
      <TabsContent value="history">{history.length === 0 ? <EmptyState icon={RotateCcw} title="No revision history yet." description="Completed reviews will be recorded here, and the next review will be scheduled automatically."/> : <div className="space-y-3">{history.map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2.5"><CheckCircle2 className="h-5 w-5 text-emerald-600"/><div><p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.topic_label}</p><p className="text-xs text-slate-500">{item.subject} · Review #{item.revision_number} · {new Date(item.reviewed_at).toLocaleString()}</p></div></div><Badge variant="success">Reviewed</Badge></div>)}</div>}</TabsContent>
    </Tabs>}
    <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}><DialogContent><DialogHeader><DialogTitle>Schedule Topic Revision</DialogTitle><DialogDescription>Choose a topic and the first review interval. Completing a review records its history and schedules the next cycle.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="flex flex-col gap-1.5"><Label htmlFor="rev-subject">Subject</Label><Select id="rev-subject" value={subject} onChange={e => setSubject(e.target.value)}>{[...CS_SUBJECTS, ...DA_SUBJECTS].map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</Select></div><div className="flex flex-col gap-1.5"><Label htmlFor="rev-topic" required>Topic</Label><Input id="rev-topic" placeholder="e.g. Recurrence Relations" value={topic} onChange={e => setTopic(e.target.value)}/></div><div className="flex flex-col gap-1.5"><Label htmlFor="rev-interval">First Review Interval</Label><Select id="rev-interval" value={interval} onChange={e => setInterval(Number(e.target.value))}><option value={3}>3 days</option><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option></Select></div></div><DialogFooter><DialogClose><Button variant="outline">Cancel</Button></DialogClose><Button onClick={() => void handleSchedule()} disabled={saving || !topic.trim()}>{saving ? 'Saving…' : 'Schedule'}</Button></DialogFooter></DialogContent></Dialog>
  </div>
}
