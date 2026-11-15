'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronRight, CheckCircle2, XCircle, RotateCcw, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiRequest } from '@/lib/client/api'

interface MCQQuestion {
  question: string
  options: string[] | { A: string; B: string; C: string; D: string }
  correct: 'A' | 'B' | 'C' | 'D' | number
  explanation?: string
  subject?: string
  topic?: string
  year?: number
  paper?: string
}

type QuizState = 'loading' | 'ready' | 'active' | 'finished' | 'error'

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const

function getOptions(q: MCQQuestion): string[] {
  if (Array.isArray(q.options)) return q.options.slice(0, 4)
  return [q.options.A, q.options.B, q.options.C, q.options.D]
}

function getCorrectIndex(q: MCQQuestion): number {
  if (typeof q.correct === 'number') return q.correct
  return OPTION_KEYS.indexOf(q.correct as 'A' | 'B' | 'C' | 'D')
}

export default function LibraryTestPage() {
  const params = useParams()
  const router = useRouter()
  const resourceId = params.resourceId as string

  const [state, setState] = useState<QuizState>('loading')
  const [questions, setQuestions] = useState<MCQQuestion[]>([])
  const [title, setTitle] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answered, setAnswered] = useState<boolean[]>([])
  const [userAnswers, setUserAnswers] = useState<number[]>([])
  const [showExplanation, setShowExplanation] = useState(false)

  useEffect(() => {
    async function loadQuiz() {
      try {
        // Get resource metadata
        const resource = await apiRequest<{ id: string; title: string; file_type: string; status: string; object_key?: string }>('/api/v1/library/' + resourceId)
        setTitle(resource.title)
        if (resource.file_type !== 'json') {
          setErrorMsg('This resource is not a question bank (JSON file).')
          setState('error')
          return
        }
        // Get signed download URL
        const { downloadUrl } = await apiRequest<{ downloadUrl: string }>('/api/v1/library/' + resourceId + '/download')
        // Fetch the JSON
        const resp = await fetch(downloadUrl)
        if (!resp.ok) throw new Error('Could not fetch question bank')
        const data = await resp.json() as unknown
        const arr = Array.isArray(data) ? data : (data as Record<string, unknown>).questions
        if (!Array.isArray(arr) || arr.length === 0) throw new Error('No questions found in this file')
        setQuestions(arr as MCQQuestion[])
        setAnswered(new Array(arr.length).fill(false) as boolean[])
        setUserAnswers(new Array(arr.length).fill(-1) as number[])
        setState('ready')
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Could not load quiz')
        setState('error')
      }
    }
    void loadQuiz()
  }, [resourceId])

  function startQuiz() {
    setCurrent(0); setSelected(null); setShowExplanation(false); setState('active')
  }

  function selectOption(idx: number) {
    if (answered[current]) return
    setSelected(idx)
  }

  function submitAnswer() {
    if (selected === null || answered[current]) return
    const newAnswered = [...answered]; newAnswered[current] = true; setAnswered(newAnswered)
    const newUserAnswers = [...userAnswers]; newUserAnswers[current] = selected; setUserAnswers(newUserAnswers)
    setShowExplanation(true)
  }

  function nextQuestion() {
    if (current + 1 >= questions.length) { setState('finished'); return }
    setCurrent(c => c + 1); setSelected(null); setShowExplanation(false)
  }

  function restart() {
    setCurrent(0); setSelected(null)
    setAnswered(new Array(questions.length).fill(false) as boolean[])
    setUserAnswers(new Array(questions.length).fill(-1) as number[])
    setShowExplanation(false); setState('active')
  }

  const score = userAnswers.filter((ans, i) => ans === getCorrectIndex(questions[i])).length
  const q = questions[current]
  const opts = q ? getOptions(q) : []
  const correctIdx = q ? getCorrectIndex(q) : -1

  if (state === 'loading') return (
    <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin"/>Loading question bank…
    </div>
  )

  if (state === 'error') return (
    <div className="mx-auto max-w-xl space-y-4 py-12">
      <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        <AlertTriangle className="h-4 w-4 shrink-0"/>{errorMsg}
      </div>
      <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
    </div>
  )

  if (state === 'ready') return (
    <div className="mx-auto max-w-xl space-y-6 py-8">
      <div><h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1><p className="mt-1 text-sm text-slate-500">{questions.length} questions in this bank.</p></div>
      <Button onClick={startQuiz}><ChevronRight className="mr-1.5 h-4 w-4"/>Start Test</Button>
    </div>
  )

  if (state === 'finished') return (
    <div className="mx-auto max-w-xl space-y-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Test Complete!</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
        <p className="text-4xl font-bold text-indigo-600">{score}/{questions.length}</p>
        <p className="mt-2 text-sm text-slate-500">{Math.round(score / questions.length * 100)}% correct</p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.back()}>Back to Library</Button>
        <Button onClick={restart}><RotateCcw className="mr-1.5 h-4 w-4"/>Retry</Button>
      </div>
    </div>
  )

  // active state
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">{title}</h1>
        <span className="shrink-0 text-xs font-semibold text-slate-400">Q {current + 1} / {questions.length}</span>
      </div>
      <div className="flex gap-2">
        {q.subject && <Badge variant="outline">{q.subject}</Badge>}
        {q.topic && <span className="text-xs text-slate-500">{q.topic}</span>}
        {q.year && <Badge variant="secondary">{q.year}</Badge>}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm font-medium leading-relaxed text-slate-900 dark:text-slate-100 whitespace-pre-line">{q.question}</p>
      </div>
      <div className="space-y-2">
        {opts.map((opt, idx) => {
          const isSelected = selected === idx
          const isCorrect = idx === correctIdx
          const isWrong = answered[current] && isSelected && !isCorrect
          return (
            <button
              key={idx}
              onClick={() => selectOption(idx)}
              disabled={answered[current]}
              className={[
                'w-full rounded-lg border p-3 text-left text-sm transition-colors',
                answered[current] && isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' :
                isWrong ? 'border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200' :
                isSelected ? 'border-indigo-400 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200' :
                'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
              ].join(' ')}
            >
              <span className="font-semibold mr-2">{OPTION_KEYS[idx]}.</span>{opt}
              {answered[current] && isCorrect && <CheckCircle2 className="inline ml-2 h-4 w-4 text-emerald-600" aria-hidden />}
              {isWrong && <XCircle className="inline ml-2 h-4 w-4 text-rose-600" aria-hidden />}
            </button>
          )
        })}
      </div>
      {showExplanation && q.explanation && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300">
          <span className="font-semibold">Explanation: </span>{q.explanation}
        </div>
      )}
      <div className="flex gap-3">
        {!answered[current] && (
          <Button disabled={selected === null} onClick={submitAnswer}>Submit Answer</Button>
        )}
        {answered[current] && (
          <Button onClick={nextQuestion}>
            {current + 1 >= questions.length ? 'View Score' : 'Next'}<ChevronRight className="ml-1 h-4 w-4"/>
          </Button>
        )}
      </div>
    </div>
  )
}
