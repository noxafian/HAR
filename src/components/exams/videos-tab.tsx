'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/client/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { MonitorPlay, Loader2 } from 'lucide-react'
import type { ExamPaper } from '@/types/exam'

interface Video {
  id: string
  paper: 'CS' | 'DA' | 'GA'
  subject_name: string
  topic_name: string | null
  youtube_id: string
  title: string
  description: string | null
  duration_seconds: number | null
  display_order: number
  created_at: string
}

export function VideosTab({ paper }: { paper: ExamPaper }) {
  const [items, setItems] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [active, setActive] = useState<Video | null>(null)

  useEffect(() => {
    let activeRequest = true
    setLoading(true)
    apiRequest<{ items: Video[] }>(`/api/v1/videos?paper=${paper}`)
      .then(res => { if (activeRequest) { setItems(res.items); setError(false) } })
      .catch(() => { if (activeRequest) setError(true) })
      .finally(() => { if (activeRequest) setLoading(false) })
    return () => { activeRequest = false }
  }, [paper])

  if (loading) {
    return <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading video lessons…</div>
  }
  if (error || !items.length) {
    return <EmptyState icon={MonitorPlay} title="No video lessons yet." description="The admin will add topic-wise video lectures here."/>
  }

  const groups = items.reduce<Record<string, Video[]>>((acc, v) => {
    (acc[v.subject_name] ??= []).push(v)
    return acc
  }, {})

  return (
    <>
      <div className="space-y-6">
        {Object.entries(groups).map(([subject, videos]) => (
          <section key={subject}>
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{subject}</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setActive(v)}
                  className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition-colors hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-700"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img src={`https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg`} alt={v.title} loading="lazy" className="h-full w-full object-cover"/>
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-slate-100">{v.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{v.subject_name}{v.topic_name ? ` · ${v.topic_name}` : ''}{v.duration_seconds ? ` · ${Math.round(v.duration_seconds / 60)} min` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <Dialog open={!!active} onOpenChange={open => { if (!open) setActive(null) }}>
        {active && (
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{active.title}</DialogTitle>
            </DialogHeader>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${active.youtube_id}?autoplay=1`}
              title={active.title}
              className="aspect-video w-full rounded-lg"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
            {active.description && <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{active.description}</p>}
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
