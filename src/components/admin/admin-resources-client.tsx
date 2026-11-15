'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest, jsonBody } from '@/lib/client/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { AlertCircle, FolderOpen, RefreshCw, CheckCircle, XCircle, Trash2, Search, Upload } from 'lucide-react'

type Resource = {
  id: string
  title: string
  description: string | null
  paper: 'CS' | 'DA' | 'GA' | null
  subject_name: string | null
  topic_name: string | null
  file_type: string
  file_size: number
  status: string
  category: string | null
  uploader_name: string | null
  uploaded_by: string
  created_at: string
  download_count: number
}

type PageData = { items: Resource[]; total: number; page: number; limit: number; hasMore: boolean }

function bytes(n: number): string {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), 3)
  return `${(n / 1024 ** i).toFixed(1)} ${u[i]}`
}

function categoryBadge(cat: string | null) {
  const labels: Record<string, string> = {
    'notes': 'Notes',
    'year-wise-paper': 'Year-wise',
    'subject-wise-paper': 'Subject-wise',
    'topic-wise-paper': 'Topic-wise',
  }
  return (
    <Badge variant="outline" className="text-xs">
      {cat ? (labels[cat] ?? cat) : 'Notes'}
    </Badge>
  )
}

export function AdminResourcesClient() {
  const [data, setData] = useState<PageData | null>(null)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Upload form
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploadPaper, setUploadPaper] = useState<'CS' | 'DA' | 'GA'>('CS')
  const [uploadCategory, setUploadCategory] = useState('notes')
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const q = new URLSearchParams({ page: '1', limit: '100' })
      if (status) q.set('status', status)
      if (applied) q.set('search', applied)
      setData(await apiRequest<PageData>(`/api/v1/admin/resources?${q}`))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resources could not be loaded')
    }
  }, [status, applied])

  useEffect(() => { void load() }, [load])

  async function moderate(r: Resource, next: 'verified' | 'rejected') {
    setBusy(r.id); setError(''); setNotice('')
    try {
      await apiRequest(`/api/v1/library/${r.id}/verify`, { method: 'POST', body: jsonBody({ status: next }) })
      setNotice(`${r.title} marked ${next}.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Moderation failed')
    } finally {
      setBusy('')
    }
  }

  async function remove(r: Resource) {
    if (!window.confirm(`Permanently remove the stored object for "${r.title}"?`)) return
    setBusy(r.id); setError(''); setNotice('')
    try {
      await apiRequest<void>(`/api/v1/library/${r.id}`, { method: 'DELETE' })
      setNotice(`${r.title} removed.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resource deletion failed')
    } finally {
      setBusy('')
    }
  }

  async function handleUpload() {
    if (!uploadFile || !uploadTitle.trim() || uploadBusy) return
    setUploadBusy(true); setUploadError('')
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('title', uploadTitle.trim())
      if (uploadDesc.trim()) formData.append('description', uploadDesc.trim())
      formData.append('paper', uploadPaper)
      formData.append('category', uploadCategory)
      await apiRequest<{ resourceId: string }>('/api/v1/library/upload', { method: 'POST', body: formData })
      setNotice('Resource uploaded successfully.')
      setShowUpload(false)
      setUploadFile(null); setUploadTitle(''); setUploadDesc(''); setUploadPaper('CS'); setUploadCategory('notes')
      await load()
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploadBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Resource Moderation</h1>
          <p className="mt-1 text-muted-foreground">Review member uploads before they become visible in the shared library.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowUpload(v => !v)}>
            <Upload className="mr-2 h-4 w-4" />Upload Resource
          </Button>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
        </div>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Upload New Resource</h2>
          {uploadError && (
            <p role="alert" className="text-sm text-destructive">
              <AlertCircle className="mr-1 inline h-4 w-4" />{uploadError}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-upload-category">Category <span className="text-rose-500">*</span></Label>
              <Select
                id="admin-upload-category"
                value={uploadCategory}
                onChange={e => setUploadCategory(e.target.value)}
              >
                <option value="notes">Notes</option>
                <option value="year-wise-paper">Year-wise Paper</option>
                <option value="subject-wise-paper">Subject-wise Paper</option>
                <option value="topic-wise-paper">Topic-wise Paper</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-upload-paper">Exam</Label>
              <Select
                id="admin-upload-paper"
                value={uploadPaper}
                onChange={e => setUploadPaper(e.target.value as 'CS' | 'DA' | 'GA')}
              >
                <option value="CS">CS</option>
                <option value="DA">DA</option>
                <option value="GA">GA</option>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-upload-title">Title <span className="text-rose-500">*</span></Label>
            <Input
              id="admin-upload-title"
              value={uploadTitle}
              onChange={e => setUploadTitle(e.target.value)}
              placeholder="Resource title"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-upload-desc">Description (optional)</Label>
            <Textarea
              id="admin-upload-desc"
              value={uploadDesc}
              onChange={e => setUploadDesc(e.target.value)}
              placeholder="What's in this file?"
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-upload-file">File <span className="text-rose-500">*</span></Label>
            <Input
              id="admin-upload-file"
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg,.json"
              onChange={e => {
                const f = e.target.files?.[0] ?? null
                setUploadFile(f)
                const derived = f?.name
                  .replace(/\.[^.]+$/, '')
                  .replace(/[-_]+/g, ' ')
                  .replace(/^./, c => c.toUpperCase())
                if (derived && !uploadTitle) setUploadTitle(derived)
              }}
            />
            <p className="text-xs text-muted-foreground">PDF, DOCX, PPTX, TXT, PNG, JPG, JSON · Max 50 MB</p>
          </div>
          <div className="flex gap-2">
            <Button disabled={uploadBusy || !uploadFile || !uploadTitle.trim()} isLoading={uploadBusy} onClick={() => void handleUpload()}>
              Upload
            </Button>
            <Button variant="outline" onClick={() => { setShowUpload(false); setUploadError('') }}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Search + filter */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setApplied(search.trim()) }}>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title or description" />
            <Button type="submit" variant="outline"><Search className="h-4 w-4" /></Button>
          </form>
          <Select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {['pending', 'verified', 'rejected', 'unverified'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <Badge variant="outline" className="self-center">{data?.total ?? '—'} resources</Badge>
        </div>
      </Card>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          <AlertCircle className="mr-1 inline h-4 w-4" />{error}
        </p>
      )}
      {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}

      {/* Table */}
      <Card className="overflow-auto">
        {!data && !error ? (
          <p className="p-5 text-sm text-muted-foreground">Loading resources…</p>
        ) : !data?.items.length ? (
          <div className="p-5">
            <EmptyState icon={FolderOpen} title="No resources match" description="Uploads awaiting review and previously moderated resources appear here." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Uploader</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.items.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium truncate text-slate-900 dark:text-slate-100">{r.title}</p>
                    {r.paper && <p className="text-xs text-muted-foreground">{r.paper}{r.subject_name ? ` · ${r.subject_name}` : ''}</p>}
                  </td>
                  <td className="px-4 py-3">{categoryBadge(r.category)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{r.file_type.toUpperCase()}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{bytes(Number(r.file_size))}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[120px] truncate">{r.uploader_name ?? r.uploaded_by}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.status === 'verified' ? 'default' : r.status === 'rejected' ? 'destructive' : 'outline'}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {r.status !== 'verified' && (
                        <Button size="sm" disabled={busy === r.id} onClick={() => void moderate(r, 'verified')}>
                          <CheckCircle className="mr-1 h-3.5 w-3.5" />Verify
                        </Button>
                      )}
                      {r.status !== 'rejected' && (
                        <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => void moderate(r, 'rejected')}>
                          <XCircle className="mr-1 h-3.5 w-3.5" />Reject
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => void remove(r)}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" />Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
