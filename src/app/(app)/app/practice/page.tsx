'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell, Calendar, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { apiRequest } from '@/lib/client/api'
import { CS_SUBJECTS, DA_SUBJECTS, GA_SUBJECTS } from '@/lib/constants'

const YEARS = Array.from({ length: 10 }, (_, i) => 2024 - i) // 2024 down to 2015

interface SubjectCardProps {
  id: string
  name: string
  paper: 'CS' | 'DA' | 'GA'
}

function SubjectCard({ id, name, paper }: SubjectCardProps) {
  const router = useRouter()
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    apiRequest<{ total: number }>(`/api/v1/questions?subject=${encodeURIComponent(name)}&paper=${paper}&limit=1`)
      .then(r => setCount(r.total))
      .catch(() => setCount(0))
  }, [name, paper])

  return (
    <button
      className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/30"
      onClick={() => router.push(`/app/practice/${id}?paper=${paper}`)}
    >
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</span>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{paper}</Badge>
        {count === null ? (
          <span className="text-xs text-slate-400"><Loader2 className="inline h-3 w-3 animate-spin" /> loading…</span>
        ) : count === 0 ? (
          <span className="text-xs text-slate-400">No questions yet</span>
        ) : (
          <span className="text-xs text-slate-500">{count} questions</span>
        )}
      </div>
    </button>
  )
}

export default function PracticeLandingPage() {
  const [tab, setTab] = useState<'subject' | 'year'>('subject')
  const [yearCounts, setYearCounts] = useState<Record<number, number | null>>({})
  const router = useRouter()

  useEffect(() => {
    if (tab !== 'year') return
    for (const year of YEARS) {
      apiRequest<{ total: number }>(`/api/v1/questions?year=${year}&limit=1`)
        .then(r => setYearCounts(prev => ({ ...prev, [year]: r.total })))
        .catch(() => setYearCounts(prev => ({ ...prev, [year]: 0 })))
    }
  }, [tab])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Practice</h1>
        <p className="mt-1 text-sm text-slate-500">Practice PYQ questions by subject or by year.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/50 w-fit">
        <button
          onClick={() => setTab('subject')}
          className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'subject'
              ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          <Dumbbell className="h-4 w-4" /> By Subject
        </button>
        <button
          onClick={() => setTab('year')}
          className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'year'
              ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          <Calendar className="h-4 w-4" /> By Year
        </button>
      </div>

      {tab === 'subject' && (
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">GATE CS</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CS_SUBJECTS.map(s => (
                <SubjectCard key={s.id} id={s.id} name={s.name} paper="CS" />
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">GATE DA</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DA_SUBJECTS.map(s => (
                <SubjectCard key={s.id} id={s.id} name={s.name} paper="DA" />
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">General Aptitude</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {GA_SUBJECTS.map(s => (
                <SubjectCard key={s.id} id={s.id} name={s.name} paper="GA" />
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'year' && (
        <div className="space-y-3">
          {YEARS.map(year => (
            <Card key={year}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <span className="text-base font-semibold text-slate-900 dark:text-slate-100">GATE {year}</span>
                  <span className="ml-3 text-sm text-slate-500">
                    {yearCounts[year] === undefined ? (
                      <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
                    ) : yearCounts[year] === 0 ? (
                      'No questions yet'
                    ) : (
                      `${yearCounts[year]} questions`
                    )}
                  </span>
                </div>
                <button
                  className="rounded-md border border-indigo-300 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-900/30 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={yearCounts[year] === 0}
                  onClick={() => router.push(`/app/practice/cs-algorithms?paper=CS&year=${year}`)}
                >
                  Practice
                </button>
              </CardContent>
            </Card>
          ))}
          <p className="text-center text-xs text-slate-400 mt-4">Year-wise practice uses GATE CS questions. Admin must upload PYQ JSON files to populate questions.</p>
        </div>
      )}
    </div>
  )
}
