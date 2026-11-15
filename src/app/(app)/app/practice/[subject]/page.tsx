'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, AlertCircle, ChevronRight, Trophy,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { apiRequest, jsonBody } from '@/lib/client/api'
import { cn } from '@/lib/cn'

interface PracticeOption { id: string; text: string }
interface PracticeQuestion {
  id: string
  prompt: string
  type: string
  options: string[] | null
  marks: number
  year: number | null
  subject_name: string
  topic_name: string
  paper: string
}
interface Solution { officialAnswer: string | string[] | number | null; solution: string | null }
interface PageData { items: PracticeQuestion[]; total: number; hasMore: boolean }

const BATCH = 20

function parseOptions(raw: string[] | null): PracticeOption[] {
  if (!raw) return []
  return raw.map((text, i) => ({ id: String.fromCharCode(65 + i), text }))
}

export default function PracticePage({
  params,
}: {
  params: Promise<{ subject: string }> | { subject: string }
}) {
  const resolved = params && 'then' in params ? use(params) : params
  const subjectParam = decodeURIComponent(resolved.subject)
  const searchParams = useSearchParams()
  const router = useRouter()

  const paper = searchParams.get('paper') ?? 'CS'
  const topicFilter = searchParams.get('topic') ?? ''

  // Available topics extracted from loaded questions for filter dropdown
  const [topicQuery, setTopicQuery] = useState(topicFilter)

  // Question bank (fetched in batches)
  const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [loadingBatch, setLoadingBatch] = useState(true)
  const [batchError, setBatchError] = useState('')

  // Session state
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [solution, setSolution] = useState<Solution | null>(null)
  const [solutionLoading, setSolutionLoading] = useState(false)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionAttempted, setSessionAttempted] = useState(0)
  const [sessionDone, setSessionDone] = useState(false)
  const startTimeRef = useRef<number>(Date.now())

  // unique topics from loaded batch
  const topics = [...new Set(questions.map(q => q.topic_name).filter(Boolean))]

  const loadQuestions = useCallback(async (subj: string, ppr: string, topic: string) => {
    setLoadingBatch(true); setBatchError('')
    try {
      const params = new URLSearchParams({ limit: String(BATCH), offset: '0', subject: subj, paper: ppr })
      if (topic) params.set('topic', topic)
      const result = await apiRequest<PageData>(`/api/v1/questions?${params.toString()}`)
      setQuestions(result.items)
      setTotal(result.total)
    } catch (e) {
      setBatchError(e instanceof Error ? e.message : 'Could not load questions')
    } finally {
      setLoadingBatch(false)
    }
  }, [])

  useEffect(() => {
    setCurrentIdx(0)
    setSelected(null)
    setRevealed(false)
    setSolution(null)
    setSessionCorrect(0)
    setSessionAttempted(0)
    setSessionDone(false)
    startTimeRef.current = Date.now()
    void loadQuestions(subjectParam, paper, topicQuery)
  }, [subjectParam, paper, topicQuery, loadQuestions])

  const currentQuestion = questions[currentIdx]
  const options = parseOptions(currentQuestion?.options ?? null)

  async function revealAnswer(optionId: string) {
    if (revealed || !currentQuestion) return
    setSelected(optionId)
    setRevealed(true)

    // Fetch correct answer
    setSolutionLoading(true)
    let sol: Solution | null = null
    try {
      sol = await apiRequest<Solution>(`/api/v1/questions/${currentQuestion.id}`)
      setSolution(sol)
    } catch {
      // non-fatal
    } finally {
      setSolutionLoading(false)
    }

    const correctLetter = typeof sol?.officialAnswer === 'string' ? sol.officialAnswer : null
    const isCorrect = correctLetter !== null && optionId === correctLetter

    setSessionAttempted(prev => prev + 1)
    if (isCorrect) setSessionCorrect(prev => prev + 1)

    // Log mistake for wrong answers — only for UUID question ids
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentQuestion.id)
    if (!isCorrect && correctLetter && isUUID) {
      apiRequest('/api/v1/study/mistakes/auto', {
        method: 'POST',
        body: jsonBody({
          question_id: currentQuestion.id,
          your_answer: optionId,
          correct_answer: correctLetter,
          source_type: 'topic_quiz',
          source_ref: `practice-${subjectParam}`,
        }),
      }).catch(() => { /* fire-and-forget */ })
    }
  }

  function nextQuestion() {
    if (currentIdx + 1 >= questions.length) {
      setSessionDone(true)
      return
    }
    setCurrentIdx(prev => prev + 1)
    setSelected(null)
    setRevealed(false)
    setSolution(null)
  }

  function endSession() {
    setSessionDone(true)
  }

  function restartSession() {
    setCurrentIdx(0)
    setSelected(null)
    setRevealed(false)
    setSolution(null)
    setSessionCorrect(0)
    setSessionAttempted(0)
    setSessionDone(false)
    startTimeRef.current = Date.now()
  }

  const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000)
  const formatTime = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`
  const accuracy = sessionAttempted > 0 ? Math.round((sessionCorrect / sessionAttempted) * 100) : 0

  if (loadingBatch) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading questions…
      </div>
    )
  }

  if (batchError) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-10">
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {batchError}
        </div>
        <Button onClick={() => void loadQuestions(subjectParam, paper, topicQuery)}>Retry</Button>
      </div>
    )
  }

  // Session summary screen
  if (sessionDone) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-10">
        <div className="text-center">
          <Trophy className="mx-auto mb-3 h-12 w-12 text-indigo-500" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Session Complete!</h1>
          <p className="mt-1 text-sm text-slate-500">{subjectParam} practice session</p>
        </div>
        <Card>
          <CardContent className="grid grid-cols-3 gap-4 p-6 text-center">
            <div>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{sessionAttempted}</p>
              <p className="text-xs text-slate-500">Questions attempted</p>
            </div>
            <div>
              <p className={cn('text-3xl font-bold', accuracy >= 60 ? 'text-emerald-600' : accuracy >= 40 ? 'text-yellow-600' : 'text-rose-600')}>{accuracy}%</p>
              <p className="text-xs text-slate-500">Accuracy</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{formatTime(elapsedSeconds)}</p>
              <p className="text-xs text-slate-500">Time taken</p>
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-3 justify-center">
          <Button onClick={restartSession}>Practice Again</Button>
          <Button variant="outline" onClick={() => router.push('/app/pyq')}>Go to PYQ Bank</Button>
        </div>
        <div className="text-center">
          <Link href="/app/practice/algorithms" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
            ← Back to Subjects
          </Link>
        </div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-10 text-center">
        <p className="text-sm text-slate-500">No questions found for <strong>{subjectParam}</strong> with the current filters.</p>
        <Button variant="outline" onClick={() => setTopicQuery('')}>Clear topic filter</Button>
        <div>
          <Link href="/app/practice/algorithms" className="text-sm text-indigo-600 hover:underline">← Back to Subjects</Link>
        </div>
      </div>
    )
  }

  const correctLetter = typeof solution?.officialAnswer === 'string' ? solution.officialAnswer : null

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/app/practice/algorithms" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
            <ArrowLeft className="h-4 w-4" />
            Back to Subjects
          </Link>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{subjectParam}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={endSession}>
          End Session
        </Button>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={topicQuery}
          onChange={e => setTopicQuery(e.target.value)}
          className="w-56"
          aria-label="Filter by topic"
        >
          <option value="">All topics</option>
          {topics.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
        <Badge variant="outline">Paper: {paper}</Badge>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{sessionAttempted} of {total} questions attempted this session</span>
          <span>{sessionCorrect} correct · {sessionAttempted - sessionCorrect} wrong</span>
        </div>
        <Progress value={total > 0 ? (currentIdx / total) * 100 : 0} label="Session progress" />
      </div>

      {/* Question card */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold text-slate-500">
              Question {currentIdx + 1} of {questions.length}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{currentQuestion.paper}{currentQuestion.year ? ` · ${currentQuestion.year}` : ''}</Badge>
              <Badge variant="secondary">{currentQuestion.marks}M</Badge>
              <Badge variant="outline">{currentQuestion.topic_name}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-base font-medium leading-relaxed text-slate-900 dark:text-slate-100">
            {currentQuestion.prompt}
          </p>

          {options.length > 0 && (
            <div className="space-y-2.5">
              {options.map(opt => {
                const isSelected = selected === opt.id
                const isCorrectOpt = revealed && correctLetter === opt.id
                const isWrong = revealed && isSelected && !isCorrectOpt

                return (
                  <button
                    key={opt.id}
                    disabled={revealed}
                    onClick={() => void revealAnswer(opt.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border p-4 text-left text-sm transition-colors',
                      !revealed
                        ? 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-500'
                        : isCorrectOpt
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                          : isWrong
                            ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30'
                            : 'border-slate-200 bg-white opacity-60 dark:border-slate-700 dark:bg-slate-900',
                    )}
                  >
                    <span className="shrink-0 font-bold text-slate-700 dark:text-slate-300">({opt.id})</span>
                    <span className="flex-1">{opt.text}</span>
                    {revealed && isCorrectOpt && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-600" />}
                    {revealed && isWrong && <XCircle className="ml-auto h-4 w-4 shrink-0 text-rose-600" />}
                  </button>
                )
              })}
            </div>
          )}

          {/* Feedback / explanation */}
          {revealed && (
            <div className={cn(
              'rounded-lg border p-4 text-sm',
              selected === correctLetter
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20'
                : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/20',
            )}>
              {solutionLoading ? (
                <div className="flex items-center gap-2 text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading explanation…</div>
              ) : (
                <>
                  <p className={cn(
                    'font-semibold',
                    selected === correctLetter ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300',
                  )}>
                    {selected === correctLetter ? '✓ Correct!' : `✗ Incorrect — correct answer: (${correctLetter ?? '?'})`}
                  </p>
                  {solution?.solution && (
                    <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300">
                      {solution.solution}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Next button */}
          {revealed && (
            <div className="flex justify-end pt-2">
              <Button onClick={nextQuestion}>
                {currentIdx + 1 >= questions.length ? 'View Summary' : <>Next Question <ChevronRight className="ml-1 h-4 w-4" /></>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
