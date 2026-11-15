'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { VideosTab } from '@/components/exams/videos-tab'
import { BookOpen, Library, ClipboardList, RotateCcw, BarChart2, LayoutList, Loader2, ExternalLink, CheckCircle2, MonitorPlay } from 'lucide-react'
import type { ExamPaper } from '@/types/exam'
import { apiRequest, jsonBody } from '@/lib/client/api'

interface SyllabusTopic { id: string; name: string; display_order: number }
interface SyllabusSection { id: string; name: string; display_order: number; is_general_aptitude: boolean; topics: SyllabusTopic[] }
interface SyllabusResponse { paper: ExamPaper; label: string; year: number | null; sourceRef: string | null; sections: SyllabusSection[]; topicHierarchyAvailable: boolean }
interface ExamWorkspaceProps { paper: ExamPaper; title: string }

const paperBadge: Record<ExamPaper, { label: string; variant: 'default' | 'success' | 'warning' }> = {
  CS: { label: 'GATE CS 2027', variant: 'default' },
  DA: { label: 'GATE DA 2027', variant: 'success' },
  GA: { label: 'General Aptitude', variant: 'warning' },
}

export function ExamWorkspace({ paper, title }: ExamWorkspaceProps) {
  const badge = paperBadge[paper]
  const [syllabus, setSyllabus] = useState<SyllabusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [topicProgress, setTopicProgress] = useState<Map<string, { completed: boolean }>>(new Map())
  const [completionCounts, setCompletionCounts] = useState<Map<string, { completed: number; total: number }>>(new Map())
  const [togglingTopic, setTogglingTopic] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      apiRequest<SyllabusResponse>(`/api/v1/exams/syllabi?paper=${paper}`),
      apiRequest<{ subjects: Array<{ subject_id: string; exam: string; topics: Array<{ topic_id: string; completed: boolean }>; completed_count: number; total_count: number }> }>('/api/v1/study/topic-progress'),
    ])
      .then(([syllabusResult, progressResult]) => {
        if (!active) return
        setSyllabus(syllabusResult)
        const progMap = new Map<string, { completed: boolean }>()
        const countMap = new Map<string, { completed: number; total: number }>()
        for (const subj of progressResult.subjects) {
          countMap.set(subj.subject_id, { completed: subj.completed_count, total: subj.total_count })
          for (const t of subj.topics) {
            progMap.set(`${subj.subject_id}:${t.topic_id}`, { completed: t.completed })
          }
        }
        setTopicProgress(progMap)
        setCompletionCounts(countMap)
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Syllabus catalogue could not be loaded') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [paper])

  async function toggleTopic(subjectId: string, topicId: string) {
    const key = `${subjectId}:${topicId}`
    const currentCompleted = topicProgress.get(key)?.completed ?? false
    setTogglingTopic(key)
    // Optimistic update
    setTopicProgress(prev => {
      const next = new Map(prev)
      next.set(key, { completed: !currentCompleted })
      return next
    })
    setCompletionCounts(prev => {
      const next = new Map(prev)
      const old = next.get(subjectId) ?? { completed: 0, total: 0 }
      next.set(subjectId, {
        completed: !currentCompleted ? old.completed + 1 : Math.max(0, old.completed - 1),
        total: old.total,
      })
      return next
    })
    try {
      await apiRequest('/api/v1/study/topic-progress', {
        method: 'POST',
        body: jsonBody({ subject_id: subjectId, topic_id: topicId, completed: !currentCompleted }),
      })
    } catch (e) {
      // Revert optimistic update
      setTopicProgress(prev => {
        const next = new Map(prev)
        next.set(key, { completed: currentCompleted })
        return next
      })
      setCompletionCounts(prev => {
        const next = new Map(prev)
        const cur = next.get(subjectId) ?? { completed: 0, total: 0 }
        next.set(subjectId, {
          completed: currentCompleted ? cur.completed + 1 : Math.max(0, cur.completed - 1),
          total: cur.total,
        })
        return next
      })
      setError(e instanceof Error ? e.message : 'Could not update topic progress')
    } finally {
      setTogglingTopic('')
    }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-3"><div><h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1><p className="mt-1 text-sm text-slate-500">Subjects are loaded from the current database syllabus version. Topic details appear only when verified topic records have been imported.</p></div><Badge variant={badge.variant}>{badge.label}</Badge></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
    <Tabs defaultValue="subjects">
      <TabsList className="flex-wrap"><TabsTrigger value="subjects"><LayoutList className="mr-1.5 h-3.5 w-3.5"/>Subjects</TabsTrigger><TabsTrigger value="resources"><Library className="mr-1.5 h-3.5 w-3.5"/>Resources</TabsTrigger><TabsTrigger value="videos"><MonitorPlay className="mr-1.5 h-3.5 w-3.5"/>Videos</TabsTrigger><TabsTrigger value="pyq"><BookOpen className="mr-1.5 h-3.5 w-3.5"/>PYQs</TabsTrigger><TabsTrigger value="practice"><ClipboardList className="mr-1.5 h-3.5 w-3.5"/>Practice</TabsTrigger><TabsTrigger value="revision"><RotateCcw className="mr-1.5 h-3.5 w-3.5"/>Revision</TabsTrigger><TabsTrigger value="analytics"><BarChart2 className="mr-1.5 h-3.5 w-3.5"/>Analytics</TabsTrigger></TabsList>
      <TabsContent value="subjects">
        {loading ? <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading database syllabus…</div> : !syllabus?.sections.length ? <EmptyState icon={LayoutList} title="No subject catalogue is configured." description="The database has no current syllabus subject links for this paper yet."/> : <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">{syllabus.year ? `Syllabus version ${syllabus.year}` : 'No current version'} is configured. {syllabus.topicHierarchyAvailable ? 'Topic records are available below.' : 'The subject catalogue is present, but verified official topic-level content has not yet been imported. No syllabus topics or weightage are being invented.'}</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{syllabus.sections.map((section, index) => {
            const counts = completionCounts.get(section.id)
            return <article key={section.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-start gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{index + 1}</div><div className="min-w-0"><p className="text-sm font-medium text-slate-900 dark:text-slate-100">{section.name}</p><p className="mt-1 text-xs text-slate-400">{section.topics.length} topic records</p>{counts && <><div className="mt-1 text-xs text-slate-500">{counts.completed} / {counts.total} completed</div><div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full bg-emerald-500 transition-all" style={{ width: counts.total > 0 ? (counts.completed / counts.total * 100) + '%' : '0%' }} /></div></>}</div></div>{section.topics.length > 0 && <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 dark:border-slate-800">{section.topics.map(topic => <li key={topic.id} className="flex items-center justify-between gap-2 py-0.5"><span className="text-xs text-slate-600 dark:text-slate-400">{topic.name}</span><button onClick={() => void toggleTopic(section.id, topic.id)} disabled={togglingTopic === section.id + ':' + topic.id} aria-label={`Toggle ${topic.name}`}><CheckCircle2 className={topicProgress.get(section.id + ':' + topic.id)?.completed ? 'h-4 w-4 text-emerald-600' : 'h-4 w-4 text-slate-300 hover:text-slate-400'} /></button></li>)}</ul>}{section.is_general_aptitude && paper !== 'GA' && <Link href="/app/exams/general-aptitude" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">Open shared GA workspace <ExternalLink className="h-3 w-3"/></Link>}</article>
          })}</div>
        </div>}
      </TabsContent>
      <TabsContent value="resources"><p className="mb-3 text-sm text-slate-500">Resources are shared across workspaces and can be filtered by paper.</p><Link href="/app/library" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">Open Study Library →</Link></TabsContent>
      <TabsContent value="videos"><VideosTab paper={paper}/></TabsContent>
      <TabsContent value="pyq"><p className="mb-3 text-sm text-slate-500">Verified question-bank entries are searchable by paper and section.</p><Link href={`/app/pyq?paper=${paper === 'GA' ? 'GA' : paper}`} className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">Open PYQ bank →</Link></TabsContent>
      <TabsContent value="practice"><p className="mb-3 text-sm text-slate-500">Published mock tests are available from the exam engine.</p><Link href="/app/mock-tests" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">Open mock tests →</Link></TabsContent>
      <TabsContent value="revision"><p className="mb-3 text-sm text-slate-500">Your own scheduled revision items and review history are stored in the database.</p><Link href="/app/revision" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">Open Revision Centre →</Link></TabsContent>
      <TabsContent value="analytics"><p className="mb-3 text-sm text-slate-500">See performance computed from your scored attempts and saved study activity.</p><Link href="/app/analytics" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">Open analytics →</Link></TabsContent>
    </Tabs>
  </div>
}
