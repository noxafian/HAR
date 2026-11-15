'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar, Plus, Trash2, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { CS_SUBJECTS, DA_SUBJECTS } from '@/lib/constants'
import { apiRequest, jsonBody } from '@/lib/client/api'

interface StudyTask { id: string; title: string; subject_name: string; priority: 'high' | 'medium' | 'low'; scheduled_date: string; completed: boolean }
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const PRIORITY_META = { high: { label: 'High Priority', variant: 'destructive' as const }, medium: { label: 'Medium', variant: 'warning' as const }, low: { label: 'Low', variant: 'secondary' as const } }
function nextDateForDay(day: typeof DAYS[number]) {
  const target = DAYS.indexOf(day)
  const today = new Date()
  const delta = (target - ((today.getDay() + 6) % 7) + 7) % 7
  today.setDate(today.getDate() + delta)
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}
function dayFromDate(value: string): typeof DAYS[number] { return DAYS[(new Date(`${value}T12:00:00`).getDay() + 6) % 7] }

export default function PlannerPage() {
  const [tasks, setTasks] = useState<StudyTask[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [subject, setSubject] = useState('Operating Systems')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('high')
  const [targetDay, setTargetDay] = useState<typeof DAYS[number]>(DAYS[(new Date().getDay() + 6) % 7])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadTasks() {
    setLoading(true); setError('')
    try { const result = await apiRequest<{ items: StudyTask[] }>('/api/v1/planner/tasks'); setTasks(result.items) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load planner tasks') }
    finally { setLoading(false) }
  }
  useEffect(() => { void loadTasks() }, [])

  async function handleAddTask() {
    if (!taskTitle.trim() || saving) return
    setSaving(true); setError('')
    try { await apiRequest('/api/v1/planner/tasks', { method: 'POST', body: jsonBody({ title: taskTitle.trim(), subject, scheduledDate: nextDateForDay(targetDay), priority }) }); setTaskTitle(''); setAddOpen(false); await loadTasks() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save task') }
    finally { setSaving(false) }
  }
  async function toggleComplete(task: StudyTask) {
    try { await apiRequest(`/api/v1/planner/tasks/${task.id}`, { method: 'PATCH', body: jsonBody({ completed: !task.completed }) }); setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update task') }
  }
  async function deleteTask(id: string) {
    try { await apiRequest(`/api/v1/planner/tasks/${id}`, { method: 'DELETE' }); setTasks(prev => prev.filter(t => t.id !== id)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete task') }
  }
  const today = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`
  const todayTasks = useMemo(() => tasks.filter(t => t.scheduled_date === today), [tasks, today])

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Study Planner</h1><p className="mt-1 text-sm text-slate-500">Plan study targets saved to your personal account.</p></div><Button onClick={() => setAddOpen(true)}><Plus className="mr-1.5 h-4 w-4"/>Add Study Task</Button></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
    {loading ? <div className="flex justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading planner…</div> : <Tabs defaultValue="daily"><TabsList><TabsTrigger value="daily">Daily View ({todayTasks.length})</TabsTrigger><TabsTrigger value="weekly">Weekly View</TabsTrigger></TabsList><TabsContent value="daily">{todayTasks.length === 0 ? <EmptyState icon={Calendar} title="No tasks scheduled for today." description="Create a study target to build a focused preparation routine." action={{ label: 'Add your first task', onClick: () => setAddOpen(true) }}/> : <div className="space-y-2.5">{todayTasks.map(task => { const meta = PRIORITY_META[task.priority]; return <div key={task.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-3"><button onClick={() => void toggleComplete(task)} className="text-slate-400 hover:text-indigo-600" aria-label={task.completed ? 'Mark uncompleted' : 'Mark completed'}>{task.completed ? <CheckCircle2 className="h-5 w-5 text-emerald-600"/> : <Circle className="h-5 w-5"/>}</button><div><p className={`text-sm font-semibold ${task.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>{task.title}</p><p className="text-xs text-slate-500">{task.subject_name} · Today</p></div></div><div className="flex items-center gap-2"><Badge variant={meta.variant}>{meta.label}</Badge><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-500" onClick={() => void deleteTask(task.id)}><Trash2 className="h-4 w-4"/></Button></div></div> })}</div>}</TabsContent><TabsContent value="weekly"><div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">{DAYS.map(day => { const dayTasks = tasks.filter(t => dayFromDate(t.scheduled_date) === day); return <div key={day} className="flex min-h-48 flex-col rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800"><span className="text-xs font-bold text-slate-700 dark:text-slate-300">{day}</span><span className="text-[10px] text-slate-400">{dayTasks.length} tasks</span></div><div className="mt-2 flex-1 space-y-1.5 overflow-y-auto">{dayTasks.length === 0 ? <p className="pt-4 text-center text-xs italic text-slate-400">No tasks</p> : dayTasks.map(t => <div key={t.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs dark:border-slate-800 dark:bg-slate-800/50"><p className={`font-medium ${t.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>{t.title}</p><p className="truncate text-[10px] text-slate-500">{t.subject_name} · {t.scheduled_date}</p></div>)}</div></div> })}</div></TabsContent></Tabs>}
    <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent><DialogHeader><DialogTitle>Add Study Task</DialogTitle><DialogDescription>Assign a focused topic or question set to your planner.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="flex flex-col gap-1.5"><Label htmlFor="task-title">Task Description</Label><Input id="task-title" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="e.g. Solve 20 PYQs on Paging"/></div><div className="grid gap-3 sm:grid-cols-2"><div className="flex flex-col gap-1.5"><Label htmlFor="task-subject">Subject</Label><Select id="task-subject" value={subject} onChange={e => setSubject(e.target.value)}>{[...CS_SUBJECTS, ...DA_SUBJECTS].map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</Select></div><div className="flex flex-col gap-1.5"><Label htmlFor="task-day">Day of Week</Label><Select id="task-day" value={targetDay} onChange={e => setTargetDay(e.target.value as typeof DAYS[number])}>{DAYS.map(d => <option key={d} value={d}>{d}</option>)}</Select></div></div><div className="flex flex-col gap-1.5"><Label htmlFor="task-priority">Priority</Label><Select id="task-priority" value={priority} onChange={e => setPriority(e.target.value as 'high'|'medium'|'low')}><option value="high">High Priority</option><option value="medium">Medium Priority</option><option value="low">Low Priority</option></Select></div></div><DialogFooter><DialogClose><Button variant="outline">Cancel</Button></DialogClose><Button disabled={saving || !taskTitle.trim()} onClick={() => void handleAddTask()}>{saving ? 'Saving…' : 'Save Task'}</Button></DialogFooter></DialogContent></Dialog>
  </div>
}
