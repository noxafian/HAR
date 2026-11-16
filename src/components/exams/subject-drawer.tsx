'use client'

import { useRouter } from 'next/navigation'
import { CheckSquare, Square, X } from 'lucide-react'
import type { ExamPaper } from '@/types/exam'

export interface SyllabusTopic { id: string; name: string; display_order: number }
export interface SyllabusSection { id: string; name: string; display_order: number; is_general_aptitude: boolean; topics: SyllabusTopic[] }

interface SubjectDrawerProps {
  section: SyllabusSection | null
  paper: ExamPaper
  topicProgress: Map<string, { completed: boolean }>
  completionCounts: Map<string, { completed: number; total: number }>
  toggleTopic: (subjectId: string, topicId: string) => Promise<void>
  togglingTopic: string
  onClose: () => void
}

export function SubjectDrawer({
  section,
  paper,
  topicProgress,
  completionCounts,
  toggleTopic,
  togglingTopic,
  onClose,
}: SubjectDrawerProps) {
  const router = useRouter()

  if (section === null) return null

  const counts = completionCounts.get(section.id)
  const completed = counts?.completed ?? 0
  const total = counts?.total ?? 0
  const pct = total > 0 ? (completed / total) * 100 : 0

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full flex-col overflow-y-auto bg-white shadow-2xl transition-transform duration-300 sm:w-[420px] dark:bg-slate-900 translate-x-0"
        role="dialog"
        aria-modal="true"
        aria-label={section.name}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {section.name}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="border-b px-5 py-3">
          <p className="text-sm text-slate-500">
            {completed} / {total} completed
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Topics list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {section.topics.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              Topics for this subject have not been imported yet. Check back soon.
            </p>
          ) : (
            <ul className="space-y-2">
              {section.topics.map(topic => {
                const key = `${section.id}:${topic.id}`
                const isCompleted = topicProgress.get(key)?.completed ?? false
                const isToggling = togglingTopic === key

                return (
                  <li key={topic.id} className="flex items-center gap-3 py-1">
                    <button
                      onClick={() => void toggleTopic(section.id, topic.id)}
                      disabled={isToggling}
                      aria-label={`Toggle ${topic.name}`}
                      className="shrink-0"
                    >
                      {isCompleted ? (
                        <CheckSquare className="h-5 w-5 text-emerald-600 shrink-0" />
                      ) : (
                        <Square className="h-5 w-5 text-slate-300 hover:text-slate-500 shrink-0" />
                      )}
                    </button>
                    <span
                      onClick={() => {
                        sessionStorage.setItem(
                          'ai_prefill',
                          `Teach me ${topic.name} from ${section.name} for GATE ${paper} 2027. Start with a clear explanation, then cover key concepts, formulas, and typical GATE question patterns.`
                        )
                        router.push('/app/ai')
                      }}
                      className={[
                        'text-sm text-slate-700 dark:text-slate-200 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 select-none',
                        isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {topic.name}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
