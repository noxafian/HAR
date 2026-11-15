'use client'

import { useEffect, use, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Clock, ShieldAlert, Loader2 } from 'lucide-react'
import { apiRequest, jsonBody } from '@/lib/client/api'
import type { QuestionStatus } from '@/types/mock-test'
import type { QuestionType } from '@/types/question'

interface ExamOption { id: string; text: string }
interface ExamQuestion { id: string; type: QuestionType; marks: number; text: string; options?: ExamOption[]; year?: number | null; sourceReference?: string | null }
interface ExamSession {
  sessionId: string; examId: string; paper: 'CS' | 'DA'; title: string; serverNow: string;
  expiresAt: string; durationSeconds: number; totalQuestions: number; totalMarks: number;
  status: string; questions: ExamQuestion[];
  savedAnswers?: Record<string, { answer: string | string[] | null; markedForReview: boolean }>;
}
interface ExamScore { resultId: string; alreadyScored: boolean; totalMarks: number; totalMarksRaw: number; maxPossibleMarks: number; correct: number; incorrect: number; unanswered: number; accuracy: number; durationSeconds: number; questionResults?: { questionId: string; outcome: string; marksAwarded: number; maxMarks: number }[] }
const STATUS_COLORS: Record<QuestionStatus, string> = {
  'not-answered': 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
  'answered': 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200',
  'marked-for-review': 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900 dark:text-orange-200',
  'answered-and-marked': 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200',
}
function formatClock(total: number) { const safe = Math.max(0, total); return `${String(Math.floor(safe / 3600)).padStart(2, '0')}:${String(Math.floor((safe % 3600) / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}` }

export default function MockTestPage({ params }: { params: Promise<{ testId: string }> | { testId: string } }) {
  const resolved = params && 'then' in params ? use(params) : params
  const testId = resolved?.testId || ''
  const router = useRouter()
  const [session, setSession] = useState<ExamSession | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [marked, setMarked] = useState<Record<string, boolean>>({})
  const [remaining, setRemaining] = useState(0)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [score, setScore] = useState<ExamScore | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [autosaveMessage, setAutosaveMessage] = useState('')
  const clockOffsetMs = useRef(0)
  const lastSaveSignature = useRef<Record<string, string>>({})
  const inFlightSaves = useRef<Record<string, Promise<boolean>>>({})
  const activeSaveCount = useRef(0)
  const debounceTimers = useRef<Record<string, number>>({})
  const submittedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function start() {
      setLoading(true); setError('')
      try {
        const result = await apiRequest<ExamSession>(`/api/v1/exams/${testId}/session`, { method: 'POST' })
        if (cancelled) return
        setSession(result)
        clockOffsetMs.current = new Date(result.serverNow).getTime() - Date.now()
        const restoredAnswers: Record<string, string | string[]> = {}
        const restoredMarks: Record<string, boolean> = {}
        const restoredSignatures: Record<string, string> = {}
        for (const [questionId, row] of Object.entries(result.savedAnswers ?? {})) {
          if (row.answer !== null) restoredAnswers[questionId] = row.answer
          if (row.markedForReview) restoredMarks[questionId] = true
          restoredSignatures[questionId] = JSON.stringify({ answer: row.answer, markedForReview: row.markedForReview })
        }
        setAnswers(restoredAnswers)
        setMarked(restoredMarks)
        lastSaveSignature.current = restoredSignatures
        setRemaining(Math.max(0, Math.floor((new Date(result.expiresAt).getTime() - (Date.now() + clockOffsetMs.current)) / 1000)))
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not start exam session') }
      finally { if (!cancelled) setLoading(false) }
    }
    if (testId) void start()
    return () => { cancelled = true }
  }, [testId])

  useEffect(() => {
    if (!session || score) return
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - (Date.now() + clockOffsetMs.current)) / 1000))
      setRemaining(seconds)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [session, score])

  const currentQuestion = session?.questions[currentIndex]
  const getStatus = (questionId: string): QuestionStatus => {
    const hasAnswer = answers[questionId] !== undefined && (Array.isArray(answers[questionId]) ? (answers[questionId] as string[]).length > 0 : String(answers[questionId]).trim().length > 0)
    if (marked[questionId]) return hasAnswer ? 'answered-and-marked' : 'marked-for-review'
    return hasAnswer ? 'answered' : 'not-answered'
  }

  async function saveQuestion(questionId: string, answer: string | string[] | null, markedForReview: boolean): Promise<boolean> {
    if (!session) return false
    const signature = JSON.stringify({ answer, markedForReview })

    // Serialize writes per question. A delayed earlier autosave must never overwrite
    // a later answer flushed by the submit action.
    while (inFlightSaves.current[questionId]) {
      await inFlightSaves.current[questionId]
      if (lastSaveSignature.current[questionId] === signature) return true
    }
    if (lastSaveSignature.current[questionId] === signature) return true

    activeSaveCount.current += 1
    setSaving(true)
    const operation = (async (): Promise<boolean> => {
      try {
        await apiRequest(`/api/v1/exams/${testId}/session/${session.sessionId}/answer`, {
          method: 'POST', body: jsonBody({ questionId, answer, markedForReview }),
        })
        lastSaveSignature.current[questionId] = signature
        setAutosaveMessage('All changes saved to this attempt.')
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Answer could not be saved')
        return false
      }
    })()
    inFlightSaves.current[questionId] = operation
    try {
      return await operation
    } finally {
      if (inFlightSaves.current[questionId] === operation) delete inFlightSaves.current[questionId]
      activeSaveCount.current = Math.max(0, activeSaveCount.current - 1)
      setSaving(activeSaveCount.current > 0)
    }
  }


  function scheduleSave(question: ExamQuestion, answer: string | string[] | null, markedForReview: boolean) {
    const previous = debounceTimers.current[question.id]
    if (previous) window.clearTimeout(previous)
    debounceTimers.current[question.id] = window.setTimeout(() => {
      delete debounceTimers.current[question.id]
      void saveQuestion(question.id, answer, markedForReview)
    }, 350)
  }

  function setAnswer(question: ExamQuestion, value: string | string[]) {
    setAnswers(prev => ({ ...prev, [question.id]: value }))
    scheduleSave(question, value, Boolean(marked[question.id]))
  }
  function setReview(question: ExamQuestion) {
    const next = !marked[question.id]
    setMarked(prev => ({ ...prev, [question.id]: next }))
    scheduleSave(question, answers[question.id] ?? null, next)
  }
  function clearResponse(question: ExamQuestion) {
    setAnswers(prev => { const next = { ...prev }; delete next[question.id]; return next })
    setMarked(prev => ({ ...prev, [question.id]: false }))
    scheduleSave(question, null, false)
  }

  async function submitExam() {
    if (!session || submitting || submittedRef.current) return
    setSubmitting(true); setError('')
    try {
      // Cancel debounces first. Before the deadline, flush the latest state;
      // after expiry, the database no longer accepts writes and must score only
      // the answers already persisted before the deadline.
      Object.values(debounceTimers.current).forEach(timer => window.clearTimeout(timer))
      debounceTimers.current = {}
      const deadlinePassed = () => new Date(session.expiresAt).getTime() <= Date.now() + clockOffsetMs.current
      if (remaining > 0 && !deadlinePassed()) {
        const flushResults = await Promise.all(session.questions.map(question =>
          saveQuestion(question.id, answers[question.id] ?? null, Boolean(marked[question.id]))
        ))
        if (flushResults.some(result => !result) && !deadlinePassed()) {
          throw new Error('Some answers could not be saved. Check your connection and submit again.')
        }
      }
      // If the deadline passed while flushing, continue with the answers saved
      // before expiry; score_exam atomically expires and scores that snapshot.
      // A pending autosave may already have reached PostgreSQL. Wait for those
      // requests to finish before locking and scoring the attempt.
      await Promise.all(Object.values(inFlightSaves.current))
      const result = await apiRequest<ExamScore>(`/api/v1/exams/${testId}/session/${session.sessionId}/submit`, { method: 'POST' })
      submittedRef.current = true
      setScore(result)
      setSubmitOpen(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Exam submission failed') }
    finally { setSubmitting(false) }
  }

  useEffect(() => () => {
    Object.values(debounceTimers.current).forEach(timer => window.clearTimeout(timer))
  }, [])

  useEffect(() => {
    if (session && remaining <= 0 && !score && !loading && !submittedRef.current) void submitExam()
    // submission is guarded by a ref; timer expiry is the only automatic trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, session, score, loading])

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Starting secure exam session…</div>
  if (error && !session) return <div className="mx-auto max-w-2xl py-10"><Alert variant="warning" title="Exam could not be started">{error}</Alert><Button className="mt-4" onClick={() => router.push('/app/mock-tests')}>Back to Test Centre</Button></div>

  if (score && session) {
    // Build mark-band breakdown from session questions and score results
    const resultMap = new Map((score.questionResults ?? []).map(r => [r.questionId, r]))
    const oneMarkQs = session.questions.filter(q => q.marks === 1)
    const twoMarkQs = session.questions.filter(q => q.marks === 2)
    const oneMarkCorrect = oneMarkQs.filter(q => resultMap.get(q.id)?.outcome === 'correct').length
    const twoMarkCorrect = twoMarkQs.filter(q => resultMap.get(q.id)?.outcome === 'correct').length
    const wrongResults = (score.questionResults ?? []).filter(r => r.outcome === 'incorrect')
    const scoreRatio = score.maxPossibleMarks > 0 ? score.totalMarks / score.maxPossibleMarks : 0
    const GATE_CUTOFF = 25

    return (
      <div className="mx-auto max-w-3xl space-y-6 py-6">
        <div>
          <Badge variant="success">Submitted</Badge>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">Examination Results</h1>
          <p className="mt-1 text-sm text-slate-500">{session.title} · GATE {session.paper}</p>
        </div>

        {/* Score summary */}
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border p-4"><p className="text-xs text-slate-500">Score</p><p className="text-2xl font-bold">{Number(score.totalMarks).toFixed(2)} / {Number(score.maxPossibleMarks).toFixed(2)}</p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-slate-500">Accuracy</p><p className="text-2xl font-bold">{Number(score.accuracy).toFixed(2)}%</p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-slate-500">Correct</p><p className="text-2xl font-bold text-emerald-600">{score.correct}</p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-slate-500">Incorrect / Unanswered</p><p className="text-2xl font-bold">{score.incorrect} / {score.unanswered}</p></div>
        </div>

        {/* Mark-band breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-base">Mark-band breakdown</CardTitle><CardDescription>How you performed on 1-mark vs 2-mark questions.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">1-mark questions</p>
                <p className="mt-1 text-2xl font-bold">{oneMarkCorrect} <span className="text-sm font-normal text-slate-500">/ {oneMarkQs.length} correct</span></p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${oneMarkQs.length > 0 ? (oneMarkCorrect / oneMarkQs.length) * 100 : 0}%` }} />
                </div>
                <Link href="/app/practice/algorithms" className="mt-2 block text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                  Practice 1-mark questions →
                </Link>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">2-mark questions</p>
                <p className="mt-1 text-2xl font-bold">{twoMarkCorrect} <span className="text-sm font-normal text-slate-500">/ {twoMarkQs.length} correct</span></p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${twoMarkQs.length > 0 ? (twoMarkCorrect / twoMarkQs.length) * 100 : 0}%` }} />
                </div>
                <Link href="/app/practice/algorithms" className="mt-2 block text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                  Practice 2-mark questions →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GATE cutoff comparison */}
        <Card>
          <CardHeader><CardTitle className="text-base">GATE qualifying cutoff comparison</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Your score</p>
                <p className="text-xl font-bold">{Number(score.totalMarks).toFixed(2)} / {Number(score.maxPossibleMarks).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Estimated qualifying cutoff</p>
                <p className="text-xl font-bold">{GATE_CUTOFF} marks <span className="text-xs font-normal text-slate-400">(general category)</span></p>
              </div>
              <Badge
                variant={
                  score.totalMarks >= GATE_CUTOFF * 1.3 ? 'success'
                  : score.totalMarks >= GATE_CUTOFF ? 'warning'
                  : 'destructive'
                }
              >
                {score.totalMarks >= GATE_CUTOFF * 1.3
                  ? '✓ Well above cutoff'
                  : score.totalMarks >= GATE_CUTOFF
                    ? '⚠ Borderline — above cutoff'
                    : '✗ Below cutoff — needs improvement'}
              </Badge>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className={cn('h-full rounded-full transition-all', scoreRatio >= 0.65 ? 'bg-emerald-500' : scoreRatio >= 0.4 ? 'bg-yellow-500' : 'bg-rose-500')}
                style={{ width: `${Math.min(100, scoreRatio * 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Wrong answers list */}
        {wrongResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Incorrect answers ({wrongResults.length})</CardTitle>
              <CardDescription>Review these questions and practice similar ones in the PYQ bank.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {wrongResults.map((r, idx) => {
                const q = session.questions.find(sq => sq.id === r.questionId)
                return (
                  <div key={r.questionId} className="rounded-lg border border-rose-100 bg-rose-50/50 p-4 dark:border-rose-900 dark:bg-rose-950/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-1">Question {idx + 1} · {r.maxMarks}M</p>
                        <p className="text-sm text-slate-800 dark:text-slate-200 line-clamp-3">
                          {q ? (q.text.length > 200 ? q.text.slice(0, 200) + '…' : q.text) : `Question ID: ${r.questionId}`}
                        </p>
                      </div>
                      <Badge variant="destructive" className="shrink-0">incorrect</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href="/app/pyq" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                        View in PYQ bank →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Full question summary */}
        <Card>
          <CardHeader><CardTitle className="text-base">Full question summary</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(score.questionResults ?? []).map((item, index) => (
                <div key={item.questionId} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800">
                  <span>Question {index + 1}</span>
                  <span className={item.outcome === 'correct' ? 'text-emerald-600' : item.outcome === 'incorrect' ? 'text-rose-600' : 'text-slate-500'}>
                    {item.outcome} · {Number(item.marksAwarded).toFixed(2)} / {Number(item.maxMarks).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={() => router.push('/app/mock-tests')}>Back to Test Centre</Button>
          <Button variant="outline" onClick={() => router.push('/app/analytics')}>View Analytics</Button>
        </div>
      </div>
    )
  }

  if (!session || !currentQuestion) return <div className="p-10 text-center text-sm text-slate-500">This mock test contains no available questions.</div>
  const answeredCount = session.questions.filter(q => getStatus(q.id) === 'answered' || getStatus(q.id) === 'answered-and-marked').length
  const markedCount = session.questions.filter(q => getStatus(q.id) === 'marked-for-review' || getStatus(q.id) === 'answered-and-marked').length
  const currentAnswer = answers[currentQuestion.id]

  return <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-900"><div className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{session.title}</span><Badge variant="outline">GATE {session.paper}</Badge></div><div className="flex items-center gap-2 text-xs text-slate-500"><Clock className="h-3.5 w-3.5 text-indigo-500"/><code className={cn('rounded px-2 py-0.5 font-mono text-sm font-bold', remaining < 300 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200')}>{formatClock(remaining)}</code></div></div>
    <div className="flex min-h-0 flex-1 overflow-hidden"><div className="flex-1 overflow-y-auto p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700"><div className="flex items-center gap-2"><span className="text-base font-semibold text-slate-900 dark:text-slate-100">Question {currentIndex + 1} of {session.questions.length}</span><Badge variant={currentQuestion.type === 'MCQ' ? 'default' : currentQuestion.type === 'MSQ' ? 'secondary' : 'warning'}>{currentQuestion.type}</Badge><Badge variant="outline">{currentQuestion.marks} Mark{currentQuestion.marks > 1 ? 's' : ''}</Badge>{currentQuestion.type === 'MCQ' ? <span className="text-xs text-rose-500">Negative marking applies</span> : <span className="text-xs text-emerald-600">No negative marking</span>}</div><div className="flex items-center gap-1 text-xs text-slate-500"><ShieldAlert className="h-3.5 w-3.5"/>Server-authoritative attempt</div></div>
      <div className="mb-6 whitespace-pre-wrap text-base leading-relaxed text-slate-900 dark:text-slate-100">{currentQuestion.text}</div>
      {currentQuestion.type === 'MCQ' && <div className="space-y-3">{(currentQuestion.options ?? []).map(option => <button key={option.id} disabled={submitting} onClick={() => setAnswer(currentQuestion, option.id)} className={cn('flex w-full items-start gap-3 rounded-xl border p-4 text-left text-sm transition-colors', currentAnswer === option.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900')}><span className="font-bold">({option.id})</span><span>{option.text}</span></button>)}</div>}
      {currentQuestion.type === 'MSQ' && <div className="space-y-3">{(currentQuestion.options ?? []).map(option => { const selected = Array.isArray(currentAnswer) && currentAnswer.includes(option.id); return <div key={option.id} className={cn('rounded-xl border p-4 text-sm', selected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900')}><Checkbox id={`msq-${currentQuestion.id}-${option.id}`} label={`(${option.id}) ${option.text}`} checked={Boolean(selected)} disabled={submitting} onChange={e => { const checked = e.target.checked; const current = Array.isArray(currentAnswer) ? currentAnswer : []; setAnswer(currentQuestion, checked ? [...current, option.id] : current.filter(id => id !== option.id)) }}/></div> })}</div>}
      {currentQuestion.type === 'NAT' && <div className="max-w-sm space-y-2"><label htmlFor="nat-answer" className="text-sm font-medium">Enter numerical answer</label><Input id="nat-answer" value={typeof currentAnswer === 'string' ? currentAnswer : ''} disabled={submitting} onChange={e => setAnswer(currentQuestion, e.target.value)} placeholder="Enter a number" inputMode="decimal"/></div>}
      <div className="mt-8 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700"><Button variant="outline" size="sm" disabled={submitting} onClick={() => setReview(currentQuestion)}>{marked[currentQuestion.id] ? 'Unmark Review' : 'Mark for Review'}</Button><Button variant="ghost" size="sm" onClick={() => clearResponse(currentQuestion)} disabled={submitting || currentAnswer === undefined}>Clear Response</Button></div>
    </div><aside className="hidden w-64 shrink-0 overflow-y-auto border-l border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950 lg:block"><h2 className="text-sm font-semibold">Question Palette</h2><p className="mt-1 text-xs text-slate-500">{answeredCount} answered · {markedCount} marked</p><div className="mt-4 grid grid-cols-5 gap-2">{session.questions.map((q, i) => <button key={q.id} onClick={() => setCurrentIndex(i)} className={cn('flex h-9 items-center justify-center rounded-md border text-xs font-semibold', STATUS_COLORS[getStatus(q.id)], currentIndex === i && 'ring-2 ring-indigo-500 ring-offset-1')}>{i + 1}</button>)}</div><div className="mt-5 space-y-2 text-[11px] text-slate-500"><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-green-500"/>Answered</div><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-orange-400"/>Marked for review</div><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-blue-500"/>Answered and marked</div></div><div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800"><Button className="w-full" onClick={() => setSubmitOpen(true)}>Submit Test</Button></div></aside></div>
    <div className="flex items-center justify-between border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><div className="text-xs text-slate-500">{saving ? 'Saving…' : autosaveMessage || 'Answers are autosaved'}</div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex === 0}>Previous</Button><Button size="sm" onClick={() => setCurrentIndex(i => Math.min(session.questions.length - 1, i + 1))} disabled={currentIndex === session.questions.length - 1}>Next</Button><Button size="sm" variant="secondary" className="lg:hidden" onClick={() => setSubmitOpen(true)}>Submit</Button></div></div>
    {error && <div role="alert" className="fixed bottom-16 left-1/2 z-40 w-[min(90vw,36rem)] -translate-x-1/2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 shadow-lg">{error}</div>}
    <Dialog open={submitOpen} onOpenChange={setSubmitOpen}><DialogContent><DialogHeader><DialogTitle>Submit examination?</DialogTitle><DialogDescription>Once submitted, the server scores your saved answers and locks this attempt.</DialogDescription></DialogHeader><div className="grid grid-cols-3 gap-3 py-2 text-center"><div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="text-xl font-bold">{answeredCount}</p><p className="text-xs text-slate-500">Answered</p></div><div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="text-xl font-bold">{markedCount}</p><p className="text-xs text-slate-500">Marked</p></div><div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="text-xl font-bold">{session.questions.length - answeredCount}</p><p className="text-xs text-slate-500">Unanswered</p></div></div><Alert variant="warning" title="Submission is final">The server will calculate the result from persisted answers. You cannot change answers after submission.</Alert><DialogFooter><DialogClose><Button variant="outline" disabled={submitting}>Continue Exam</Button></DialogClose><Button onClick={() => void submitExam()} disabled={submitting}>{submitting ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin"/>Submitting…</> : 'Confirm Submit'}</Button></DialogFooter></DialogContent></Dialog>
  </div>
}
