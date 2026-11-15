'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest, jsonBody } from '@/lib/client/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CS_SUBJECTS, DA_SUBJECTS, GA_SUBJECTS } from '@/lib/constants'
import { MonitorPlay, RefreshCw, Trash2, AlertCircle, Plus, Pencil, Eye, EyeOff, Loader2 } from 'lucide-react'

type Paper = 'CS' | 'DA' | 'GA'
type Video = {
  id: string
  paper: Paper
  subject_name: string
  topic_name: string | null
  youtube_id: string
  title: string
  description: string | null
  duration_seconds: number | null
  display_order: number
  is_published: boolean
  created_by: string | null
  created_at: string
  updated_at: string | null
}

const SUBJECTS_BY_PAPER: Record<Paper, typeof CS_SUBJECTS> = {
  CS: CS_SUBJECTS,
  DA: DA_SUBJECTS,
  GA: GA_SUBJECTS,
}

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{4,20}$/

/** Extract an 11-char-ish YouTube id from a watch/embed/shorts/youtu.be URL or a bare id. */
function parseYouTubeId(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  if (YOUTUBE_ID_RE.test(value)) return value
  let url: URL
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '')
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1)
    return YOUTUBE_ID_RE.test(id) ? id : null
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v')
      return id && YOUTUBE_ID_RE.test(id) ? id : null
    }
    const m = url.pathname.match(/^\/(?:embed|shorts|v)\/([a-zA-Z0-9_-]{4,20})/)
    return m ? m[1] : null
  }
  return null
}

function durationLabel(seconds: number | null): string {
  if (!seconds) return ''
  return `${Math.round(seconds / 60)} min`
}

export function AdminVideosClient() {
  const [items, setItems] = useState<Video[] | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Add-form fields
  const [urlInput, setUrlInput] = useState('')
  const [paper, setPaper] = useState<Paper>('CS')
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('')
  const [displayOrder, setDisplayOrder] = useState('')

  // Edit-dialog fields
  const [editing, setEditing] = useState<Video | null>(null)
  const [editUrl, setEditUrl] = useState('')
  const [editPaper, setEditPaper] = useState<Paper>('CS')
  const [editSubject, setEditSubject] = useState('')
  const [editTopic, setEditTopic] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editDisplayOrder, setEditDisplayOrder] = useState('0')

  const parsedId = useMemo(() => parseYouTubeId(urlInput), [urlInput])
  const editParsedId = useMemo(() => parseYouTubeId(editUrl), [editUrl])

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await apiRequest<{ items: Video[] }>('/api/v1/admin/videos')
      setItems(res.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Videos could not be loaded')
    }
  }, [])

  useEffect(() => {
    setSubject(SUBJECTS_BY_PAPER.CS[0]?.name ?? '')
    void load()
  }, [load])

  function onPaperChange(next: Paper) {
    setPaper(next)
    setSubject(SUBJECTS_BY_PAPER[next][0]?.name ?? '')
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setNotice('')
    if (!parsedId) { setError('Enter a valid YouTube URL or video ID.'); return }
    if (!subject) { setError('Select a subject.'); return }
    if (!title.trim()) { setError('Enter a title.'); return }
    setBusy('creating')
    try {
      await apiRequest('/api/v1/admin/videos', {
        method: 'POST',
        body: jsonBody({
          paper,
          subject_name: subject,
          topic_name: topic.trim() || undefined,
          youtube_id: parsedId,
          title: title.trim(),
          description: description.trim() || undefined,
          duration_seconds: duration ? Number(duration) : undefined,
          display_order: displayOrder ? Number(displayOrder) : undefined,
        }),
      })
      setNotice('Video added.')
      setUrlInput(''); setTopic(''); setTitle(''); setDescription(''); setDuration(''); setDisplayOrder('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add video')
    } finally {
      setBusy('')
    }
  }

  function openEdit(v: Video) {
    setEditing(v)
    setEditUrl(`https://www.youtube.com/watch?v=${v.youtube_id}`)
    setEditPaper(v.paper)
    setEditSubject(v.subject_name)
    setEditTopic(v.topic_name ?? '')
    setEditTitle(v.title)
    setEditDescription(v.description ?? '')
    setEditDuration(v.duration_seconds ? String(v.duration_seconds) : '')
    setEditDisplayOrder(String(v.display_order))
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setError(''); setNotice('')
    if (!editParsedId) { setError('Enter a valid YouTube URL or video ID.'); return }
    if (!editSubject) { setError('Select a subject.'); return }
    if (!editTitle.trim()) { setError('Enter a title.'); return }
    setBusy(editing.id)
    try {
      await apiRequest(`/api/v1/admin/videos/${editing.id}`, {
        method: 'PATCH',
        body: jsonBody({
          paper: editPaper,
          subject_name: editSubject,
          topic_name: editTopic.trim() || null,
          youtube_id: editParsedId,
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          duration_seconds: editDuration ? Number(editDuration) : null,
          display_order: Number(editDisplayOrder) || 0,
        }),
      })
      setNotice('Video updated.')
      setEditing(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update video')
    } finally {
      setBusy('')
    }
  }

  async function togglePublish(v: Video) {
    setBusy(v.id); setError(''); setNotice('')
    try {
      await apiRequest(`/api/v1/admin/videos/${v.id}`, {
        method: 'PATCH',
        body: jsonBody({ is_published: !v.is_published }),
      })
      setNotice(`Video ${!v.is_published ? 'published' : 'unpublished'}.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update video')
    } finally {
      setBusy('')
    }
  }

  async function remove(v: Video) {
    if (!window.confirm(`Delete “${v.title}”? This cannot be undone.`)) return
    setBusy(v.id); setError(''); setNotice('')
    try {
      await apiRequest<void>(`/api/v1/admin/videos/${v.id}`, { method: 'DELETE' })
      setNotice('Video deleted.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete video')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Video Lessons</h1>
          <p className="mt-1 text-muted-foreground">Add topic-wise YouTube lectures. New videos stay unpublished until you publish them.</p>
        </div>
        <Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive"><AlertCircle className="mr-1 inline h-4 w-4"/>{error}</p>}
      {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}

      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">Add a video</h2>
        <form onSubmit={submitAdd} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label required>YouTube URL or video ID</Label>
            <Input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ or dQw4w9WgXcQ" className="mt-1"/>
            {parsedId && (
              <div className="mt-2 flex items-center gap-3">
                <img src={`https://img.youtube.com/vi/${parsedId}/mqdefault.jpg`} alt="Thumbnail preview" className="h-16 w-28 rounded object-cover"/>
                <span className="text-xs text-muted-foreground">Detected ID: <code className="font-mono">{parsedId}</code></span>
              </div>
            )}
          </div>
          <div>
            <Label required>Paper</Label>
            <Select value={paper} onChange={e => onPaperChange(e.target.value as Paper)} className="mt-1">
              <option value="CS">CS</option>
              <option value="DA">DA</option>
              <option value="GA">GA</option>
            </Select>
          </div>
          <div>
            <Label required>Subject</Label>
            <Select value={subject} onChange={e => setSubject(e.target.value)} className="mt-1">
              {SUBJECTS_BY_PAPER[paper].map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Topic (optional)</Label>
            <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Hash Tables" className="mt-1"/>
          </div>
          <div>
            <Label required>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Video title" className="mt-1"/>
          </div>
          <div className="md:col-span-2">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description" className="mt-1"/>
          </div>
          <div>
            <Label>Duration in seconds (optional)</Label>
            <Input type="number" min={1} max={86400} value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 720" className="mt-1"/>
          </div>
          <div>
            <Label>Display order</Label>
            <Input type="number" value={displayOrder} onChange={e => setDisplayOrder(e.target.value)} placeholder="0" className="mt-1"/>
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy === 'creating'}>
              {busy === 'creating' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Adding…</> : <><Plus className="mr-2 h-4 w-4"/>Add video</>}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        {!items && !error ? <p className="text-sm text-muted-foreground">Loading videos…</p>
          : !items?.length ? <EmptyState icon={MonitorPlay} title="No videos yet" description="Add your first topic video using the form above."/>
          : <div className="space-y-3">
              {items.map(v => (
                <div key={v.id} className="flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <img src={`https://img.youtube.com/vi/${v.youtube_id}/mqdefault.jpg`} alt={v.title} className="h-16 w-28 shrink-0 rounded object-cover"/>
                    <div className="min-w-0">
                      <p className="font-medium">{v.title}</p>
                      <p className="text-sm text-muted-foreground">{v.paper} · {v.subject_name}{v.topic_name ? ` · ${v.topic_name}` : ''}{durationLabel(v.duration_seconds) ? ` · ${durationLabel(v.duration_seconds)}` : ''}</p>
                      {v.description && <p className="mt-1 line-clamp-2 text-sm">{v.description}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">Order {v.display_order} · {new Date(v.created_at).toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge variant={v.is_published ? 'success' : 'outline'}>{v.is_published ? 'Published' : 'Draft'}</Badge>
                    <Button size="sm" variant={v.is_published ? 'outline' : 'default'} disabled={busy === v.id} onClick={() => void togglePublish(v)}>
                      {v.is_published ? <><EyeOff className="mr-1 h-4 w-4"/>Unpublish</> : <><Eye className="mr-1 h-4 w-4"/>Publish</>}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === v.id} onClick={() => openEdit(v)}><Pencil className="mr-1 h-4 w-4"/>Edit</Button>
                    <Button size="sm" variant="destructive" disabled={busy === v.id} onClick={() => void remove(v)}><Trash2 className="mr-1 h-4 w-4"/>Delete</Button>
                  </div>
                </div>
              ))}
            </div>}
      </Card>

      <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null) }}>
        {editing && (
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit video</DialogTitle>
            </DialogHeader>
            <form onSubmit={submitEdit} className="grid gap-4">
              <div>
                <Label required>YouTube URL or video ID</Label>
                <Input value={editUrl} onChange={e => setEditUrl(e.target.value)} className="mt-1"/>
                {editParsedId && (
                  <div className="mt-2 flex items-center gap-3">
                    <img src={`https://img.youtube.com/vi/${editParsedId}/mqdefault.jpg`} alt="Thumbnail preview" className="h-16 w-28 rounded object-cover"/>
                    <span className="text-xs text-muted-foreground">Detected ID: <code className="font-mono">{editParsedId}</code></span>
                  </div>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label required>Paper</Label>
                  <Select
                    value={editPaper}
                    onChange={e => { const p = e.target.value as Paper; setEditPaper(p); setEditSubject(SUBJECTS_BY_PAPER[p][0]?.name ?? '') }}
                    className="mt-1"
                  >
                    <option value="CS">CS</option>
                    <option value="DA">DA</option>
                    <option value="GA">GA</option>
                  </Select>
                </div>
                <div>
                  <Label required>Subject</Label>
                  <Select value={editSubject} onChange={e => setEditSubject(e.target.value)} className="mt-1">
                    {SUBJECTS_BY_PAPER[editPaper].map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Topic (optional)</Label>
                  <Input value={editTopic} onChange={e => setEditTopic(e.target.value)} className="mt-1"/>
                </div>
                <div>
                  <Label required>Title</Label>
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="mt-1"/>
                </div>
                <div className="sm:col-span-2">
                  <Label>Description (optional)</Label>
                  <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} className="mt-1"/>
                </div>
                <div>
                  <Label>Duration in seconds (optional)</Label>
                  <Input type="number" min={1} max={86400} value={editDuration} onChange={e => setEditDuration(e.target.value)} className="mt-1"/>
                </div>
                <div>
                  <Label>Display order</Label>
                  <Input type="number" value={editDisplayOrder} onChange={e => setEditDisplayOrder(e.target.value)} className="mt-1"/>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={busy === editing.id}>{busy === editing.id ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Saving…</> : 'Save changes'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
