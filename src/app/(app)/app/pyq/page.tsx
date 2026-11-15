'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen, Search, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, SlidersHorizontal, AlertCircle, RefreshCw, Sparkles,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/client/api'
import type { QuestionType, ContentCategory } from '@/types/question'
import type { ExamPaper } from '@/types/exam'

interface QuestionItem {
  id: string
  prompt: string
  type: QuestionType
  category: ContentCategory
  paper: ExamPaper
  year: number | null
  subject_name: string
  topic_name: string
  marks: number
  difficulty: 'easy' | 'medium' | 'hard' | null
  options: string[] | null
  source_ref: string | null
  is_verified: boolean
}
interface Solution { officialAnswer: string | string[] | number | null; solution: string | null }
interface PageData { items: QuestionItem[]; total: number; hasMore: boolean }

const CATEGORY_META: Record<ContentCategory, { label: string; variant: 'success' | 'default' | 'secondary' | 'warning' }> = {
  'official-pyq':       { label: 'Official PYQ',           variant: 'success' },
  'member-contributed': { label: 'Member contributed',     variant: 'default' },
  'ai-generated':       { label: 'AI practice',            variant: 'secondary' },
  'unverified':         { label: 'Unverified',             variant: 'warning' },
}

const DIFFICULTY_META: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  easy:   { label: 'Easy',   variant: 'success' },
  medium: { label: 'Medium', variant: 'warning' },
  hard:   { label: 'Hard',   variant: 'destructive' },
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 2009 }, (_, i) => CURRENT_YEAR - i)

export default function PYQPage() {
  const router = useRouter()
  const [search, setSearch]               = useState('')
  const [paper, setPaper]                 = useState('')
  const [type, setType]                   = useState('')
  const [category, setCategory]           = useState('')
  const [year, setYear]                   = useState('')
  const [difficulty, setDifficulty]       = useState('')
  const [offset, setOffset]               = useState(0)
  const LIMIT = 20

  const [data, setData]       = useState<PageData | null>(null)
  const [solutions, setSolutions] = useState<Record<string, Solution>>({})
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // Debounce search input
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleSearchChange(value: string) {
    setSearch(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setOffset(0); void fetchQuestions(value, paper, type, category, year, difficulty, 0) }, 400)
  }

  async function fetchQuestions(
    q: string, p: string, t: string, c: string, y: string, d: string, off: number
  ) {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) })
      if (q.trim()) params.set('search', q.trim())
      if (p) params.set('paper', p)
      if (t) params.set('type', t)
      if (c) params.set('category', c)
      if (y) params.set('year', y)
      if (d) params.set('difficulty', d)
      const result = await apiRequest<PageData>(`/api/v1/questions?${params.toString()}`)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load questions')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  // Re-fetch when filters change (not search — that's debounced)
  useEffect(() => {
    setOffset(0)
    void fetchQuestions(search, paper, type, category, year, difficulty, 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper, type, category, year, difficulty])

  function changePage(newOffset: number) {
    setOffset(newOffset)
    void fetchQuestions(search, paper, type, category, year, difficulty, newOffset)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function toggleSolution(id: string) {
    if (expanded[id]) { setExpanded(prev => ({ ...prev, [id]: false })); return }
    try {
      if (!solutions[id]) {
        const result = await apiRequest<Solution>(`/api/v1/questions/${id}`)
        setSolutions(prev => ({ ...prev, [id]: result }))
      }
      setExpanded(prev => ({ ...prev, [id]: true }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load answer and solution')
    }
  }

  function handleAskAI(q: QuestionItem) {
    const prompt = [
      'Explain this GATE question step by step:',
      '',
      q.prompt,
      '',
      q.options ? `Options: ${q.options.join(' | ')}` : '',
      '',
      'Correct Answer: [not revealed until after solving]',
    ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n').trim()
    sessionStorage.setItem('ai_prefill', prompt)
    router.push('/app/ai')
  }

  const total = data?.total ?? 0
  const currentPage = Math.floor(offset / LIMIT) + 1
  const totalPages = Math.ceil(total / LIMIT)
  const hasActiveFilter = !!(paper || type || category || year || difficulty || search.trim())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">PYQ & Question Bank</h1>
        <p className="mt-1 text-sm text-slate-500">
          Verified official PYQs and reviewed member/practice questions.
          Unverified submissions are hidden until moderated.
        </p>
      </div>

      {/* Category legend */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span className="font-medium">Content types:</span>
        {Object.entries(CATEGORY_META).filter(([k]) => k !== 'unverified').map(([k, v]) => (
          <button
            key={k}
            onClick={() => { setCategory(category === k ? '' : k); setOffset(0) }}
            className="focus-visible:outline-none"
          >
            <Badge
              variant={category === k ? v.variant : 'outline'}
              className="cursor-pointer transition-opacity hover:opacity-80"
            >
              {v.label}
            </Badge>
          </button>
        ))}
        {category && (
          <button onClick={() => setCategory('')} className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
            Clear
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {/* Search spans 2 cols */}
        <div className="relative lg:col-span-2">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search questions…"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="pl-8"
            aria-label="Search questions"
          />
        </div>
        <Select value={paper} onChange={e => setPaper(e.target.value)} aria-label="Paper">
          <option value="">All Papers</option>
          <option value="CS">GATE CS</option>
          <option value="DA">GATE DA</option>
          <option value="GA">General Aptitude</option>
        </Select>
        <Select value={type} onChange={e => setType(e.target.value)} aria-label="Question type">
          <option value="">All Types</option>
          <option value="MCQ">MCQ</option>
          <option value="MSQ">MSQ</option>
          <option value="NAT">NAT</option>
        </Select>
        <Select value={year} onChange={e => setYear(e.target.value)} aria-label="Year">
          <option value="">All Years</option>
          {YEARS.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </Select>
        <Select value={difficulty} onChange={e => setDifficulty(e.target.value)} aria-label="Difficulty">
          <option value="">All Difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </Select>
      </div>

      {/* Active filter summary + clear */}
      {hasActiveFilter && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Active filters applied.</span>
          <button
            onClick={() => { setPaper(''); setType(''); setCategory(''); setYear(''); setDifficulty(''); setSearch(''); setOffset(0) }}
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void fetchQuestions(search, paper, type, category, year, difficulty, offset)}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />Retry
          </Button>
        </div>
      )}

      {/* Results count */}
      {!loading && !error && data && (
        <p className="text-xs text-slate-500">
          {total === 0 ? 'No questions found.' : `Showing ${offset + 1}–${Math.min(offset + LIMIT, total)} of ${total} question${total !== 1 ? 's' : ''}`}
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />Loading question bank…
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No verified questions yet"
          description={
            hasActiveFilter
              ? "No verified questions match these filters. Try removing a filter."
              : "The question bank is empty. Official PYQs need to be imported and verified by the owner. Member-contributed questions appear here after moderation."
          }
        />
      ) : (
        <div className="space-y-4">
          {data.items.map((q, idx) => {
            const catMeta = CATEGORY_META[q.category]
            const sol = solutions[q.id]
            return (
              <article
                key={q.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
              >
                {/* Question header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">#{offset + idx + 1}</span>
                    <Badge variant={catMeta.variant}>{catMeta.label}</Badge>
                    <Badge variant="outline">{q.paper}{q.year ? ` · ${q.year}` : ''}</Badge>
                    <Badge variant="secondary">{q.type}</Badge>
                    <Badge variant={q.marks === 2 ? 'default' : 'outline'}>{q.marks}M</Badge>
                    {q.difficulty && (
                      <Badge variant={DIFFICULTY_META[q.difficulty]?.variant ?? 'outline'}>
                        {DIFFICULTY_META[q.difficulty]?.label ?? q.difficulty}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{q.subject_name} · {q.topic_name}</span>
                </div>

                {/* Prompt */}
                <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-900 dark:text-slate-100">
                  {q.prompt}
                </p>

                {/* Options */}
                {q.options && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {q.options.map((opt, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300"
                      >
                        <span className="font-bold text-slate-900 dark:text-slate-100 shrink-0">
                          ({String.fromCharCode(65 + i)})
                        </span>
                        <span>{opt}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                  <span className="text-xs italic text-slate-400">
                    Source: {q.source_ref ?? 'Not supplied'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-indigo-600 dark:text-indigo-400"
                    onClick={() => void toggleSolution(q.id)}
                  >
                    {expanded[q.id]
                      ? <><ChevronUp className="mr-1 h-3.5 w-3.5" />Hide Answer</>
                      : <><ChevronDown className="mr-1 h-3.5 w-3.5" />View Answer & Solution</>}
                  </Button>
                </div>

                {/* Solution panel */}
                {expanded[q.id] && (
                  <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 text-xs dark:border-indigo-900 dark:bg-indigo-950/30">
                    {sol?.officialAnswer !== null && sol?.officialAnswer !== undefined ? (
                      <div className="mb-1.5 flex items-center gap-2 font-semibold text-indigo-950 dark:text-indigo-200">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>
                          Answer:{' '}
                          {Array.isArray(sol.officialAnswer)
                            ? sol.officialAnswer.join(', ')
                            : sol.officialAnswer}
                        </span>
                      </div>
                    ) : (
                      <p className="font-medium text-slate-500 dark:text-slate-400">
                        No answer key is stored for this question.
                      </p>
                    )}
                    {sol?.solution && (
                      <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300">
                        <strong>Solution: </strong>{sol.solution}
                      </p>
                    )}
                    <div className="mt-3 border-t border-indigo-100 pt-3 dark:border-indigo-900">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs text-indigo-700 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
                        onClick={() => handleAskAI(q)}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Ask AI to explain
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => changePage(offset - LIMIT)}
          >
            ← Previous
          </Button>
          <span className="text-sm text-slate-500">Page {currentPage} of {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.hasMore}
            onClick={() => changePage(offset + LIMIT)}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  )
}
