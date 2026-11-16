'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Upload, Library, Download, Loader2, FileText, RefreshCw, BookOpen, File, Image, Presentation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest } from '@/lib/client/api'
import { CS_SUBJECTS, DA_SUBJECTS } from '@/lib/constants'
import type { ResourceCategory } from '@/schemas/library.schema'

interface Resource {
  id: string
  title: string
  description: string | null
  paper: 'CS' | 'DA' | 'GA' | null
  file_type: string
  file_size: number
  status: string
  download_count: number
  created_at: string
  category: string | null
}

function fileIcon(type: string) {
  if (['png', 'jpg', 'jpeg'].includes(type)) return <Image className="h-5 w-5 shrink-0 text-emerald-500" />
  if (['pptx'].includes(type)) return <Presentation className="h-5 w-5 shrink-0 text-orange-500" />
  if (['json'].includes(type)) return <BookOpen className="h-5 w-5 shrink-0 text-purple-500" />
  if (['docx', 'txt'].includes(type)) return <File className="h-5 w-5 shrink-0 text-blue-500" />
  return <FileText className="h-5 w-5 shrink-0 text-indigo-500" />
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function paperLabel(paper: string | null): string {
  if (paper === 'CS') return 'GATE CS'
  if (paper === 'DA') return 'GATE DA'
  if (paper === 'GA') return 'General Aptitude'
  return 'General'
}

const CATEGORY_LABELS: Record<string, string> = {
  'notes': '📝 NOTES',
  'year-wise-paper': '📅 YEAR-WISE PAPERS',
  'subject-wise-paper': '📚 SUBJECT-WISE PAPERS',
  'topic-wise-paper': '🏷️ TOPIC-WISE PAPERS',
}

function categoryLabel(cat: string | null): string {
  return CATEGORY_LABELS[cat ?? ''] ?? '📄 OTHER'
}

export default function LibraryPage() {
  const router = useRouter()
  const [resources, setResources] = useState<Resource[]>([])
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [paper, setPaper] = useState('')
  const [category, setCategory] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('')
  const [uploadPaper, setUploadPaper] = useState<'CS' | 'DA' | 'GA'>('CS')
  const [uploadCategory, setUploadCategory] = useState<ResourceCategory>('notes')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [downloadingId, setDownloadingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadResources(filters = { search, type, paper, category }) {
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({ limit: '100' })
      if (filters.search.trim()) query.set('search', filters.search.trim())
      if (filters.type) query.set('type', filters.type)
      if (filters.paper) query.set('paper', filters.paper)
      if (filters.category) query.set('category', filters.category)
      const result = await apiRequest<{ items: Resource[] }>(`/api/v1/library?${query.toString()}`)
      setResources(result.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load resources')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadResources() }, [])

  async function handleUpload() {
    if (!file || !title.trim() || uploading) return
    setUploading(true)
    setError('')
    setMessage('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title.trim())
      if (description.trim()) formData.append('description', description.trim())
      if (subject) formData.append('subject', subject)
      if (topic.trim()) formData.append('topic', topic.trim())
      formData.append('paper', uploadPaper)
      formData.append('category', uploadCategory)
      const result = await apiRequest<{ resourceId: string; status: string; duplicate?: boolean }>(
        '/api/v1/library/upload', { method: 'POST', body: formData }
      )
      setMessage(result.duplicate ? 'This file already exists in the library.' : 'File uploaded — available to all members.')
      setUploadOpen(false)
      setFile(null); setTitle(''); setDescription(''); setSubject(''); setTopic(''); setUploadPaper('CS'); setUploadCategory('notes')
      await loadResources()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function downloadResource(id: string) {
    setDownloadingId(id)
    setError('')
    try {
      const result = await apiRequest<{ downloadUrl: string }>(`/api/v1/library/${id}/download`)
      window.open(result.downloadUrl, '_blank')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create download link')
    } finally {
      setDownloadingId('')
    }
  }

  // Group by category when no category filter is active; otherwise group by paper
  let groupedContent: React.ReactNode

  if (resources.length > 0) {
    if (category) {
      // Category filter active — group by paper (original behaviour)
      const groups: Record<string, Resource[]> = {}
      for (const r of resources) {
        const key = r.paper ?? 'GA'
        if (!groups[key]) groups[key] = []
        groups[key].push(r)
      }
      const paperOrder = ['CS', 'DA', 'GA']
      groupedContent = (
        <div className="space-y-8">
          {paperOrder.filter(p => groups[p]?.length).map(p => (
            <div key={p}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {paperLabel(p)} · {groups[p].length} file{groups[p].length !== 1 ? 's' : ''}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groups[p].map(item => (
                  <ResourceCard
                    key={item.id}
                    item={item}
                    downloadingId={downloadingId}
                    onDownload={downloadResource}
                    onTest={id => router.push(`/app/library/${id}/test`)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    } else {
      // No category filter — group by category
      const catGroups: Record<string, Resource[]> = {}
      for (const r of resources) {
        const key = r.category ?? 'notes'
        if (!catGroups[key]) catGroups[key] = []
        catGroups[key].push(r)
      }
      const catOrder = ['notes', 'year-wise-paper', 'subject-wise-paper', 'topic-wise-paper']
      // Collect any keys not in the standard order
      const extraKeys = Object.keys(catGroups).filter(k => !catOrder.includes(k))
      const allKeys = [...catOrder, ...extraKeys].filter(k => catGroups[k]?.length)
      groupedContent = (
        <div className="space-y-8">
          {allKeys.map(cat => (
            <div key={cat}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {categoryLabel(cat)} · {catGroups[cat].length} FILES
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {catGroups[cat].map(item => (
                  <ResourceCard
                    key={item.id}
                    item={item}
                    downloadingId={downloadingId}
                    onDownload={downloadResource}
                    onTest={id => router.push(`/app/library/${id}/test`)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Study Library</h1>
          <p className="mt-1 text-sm text-slate-500">Shared notes, PYQ PDFs, and question banks uploaded by the group.</p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="mr-1.5 h-4 w-4" />Upload
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          {message}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void loadResources() }}
            placeholder="Search by title…"
            className="pl-8"
            aria-label="Search"
          />
        </div>
        <Select
          aria-label="Filter by exam"
          value={paper}
          onChange={e => { const v = e.target.value; setPaper(v); void loadResources({ search, type, paper: v, category }) }}
        >
          <option value="">All exams</option>
          <option value="CS">GATE CS</option>
          <option value="DA">GATE DA</option>
          <option value="GA">General Aptitude</option>
        </Select>
        <Select
          aria-label="Filter by category"
          value={category}
          onChange={e => { const v = e.target.value; setCategory(v); void loadResources({ search, type, paper, category: v }) }}
        >
          <option value="">All categories</option>
          <option value="notes">Notes</option>
          <option value="year-wise-paper">Year-wise Papers</option>
          <option value="subject-wise-paper">Subject-wise Papers</option>
          <option value="topic-wise-paper">Topic-wise Papers</option>
        </Select>
        <Select
          aria-label="Filter by type"
          value={type}
          onChange={e => { const v = e.target.value; setType(v); void loadResources({ search, type: v, paper, category }) }}
        >
          <option value="">All types</option>
          <option value="pdf">PDF</option>
          <option value="json">Question Bank (JSON)</option>
          <option value="docx">Word (DOCX)</option>
          <option value="pptx">Slides (PPTX)</option>
          <option value="txt">Text</option>
          <option value="png">Image</option>
        </Select>
        <Button variant="outline" size="icon" onClick={() => void loadResources()} aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />Loading library…
        </div>
      ) : resources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700">
          <Library className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 font-semibold text-slate-800 dark:text-slate-200">No resources yet</h2>
          <p className="mt-1 text-sm text-slate-500">Be the first to upload notes or a question bank for the group.</p>
          <Button className="mt-4" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" />Upload Resource
          </Button>
        </div>
      ) : groupedContent}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Resource</DialogTitle>
            <DialogDescription>Share notes, PYQ PDFs, or question bank JSON files with the group.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Category — required, first */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="upload-category">Category <span className="text-rose-500">*</span></Label>
              <Select
                id="upload-category"
                value={uploadCategory}
                onChange={e => setUploadCategory(e.target.value as ResourceCategory)}
              >
                <option value="notes">Notes</option>
                <option value="year-wise-paper">Year-wise Paper</option>
                <option value="subject-wise-paper">Subject-wise Paper</option>
                <option value="topic-wise-paper">Topic-wise Paper</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="upload-paper">Exam</Label>
                <Select
                  id="upload-paper"
                  value={uploadPaper}
                  onChange={e => { setUploadPaper(e.target.value as 'CS' | 'DA' | 'GA'); setSubject(''); setTopic('') }}
                >
                  <option value="CS">GATE CS</option>
                  <option value="DA">GATE DA</option>
                  <option value="GA">General Aptitude</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="upload-subject">Subject</Label>
                <Select id="upload-subject" value={subject} onChange={e => setSubject(e.target.value)}>
                  <option value="">Uncategorised</option>
                  {(uploadPaper === 'CS' ? CS_SUBJECTS : uploadPaper === 'DA' ? DA_SUBJECTS : [{ id: 'ga-general', name: 'General Aptitude', order: 1 }])
                    .map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="upload-title">Title <span className="text-rose-500">*</span></Label>
              <Input
                id="upload-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Operating Systems — Complete Notes"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="upload-topic">Topic (optional)</Label>
              <Input
                id="upload-topic"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Page Replacement Algorithms"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="upload-desc">Description (optional)</Label>
              <Textarea
                id="upload-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What's in this file?"
                maxLength={500}
                rows={2}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="upload-file">File <span className="text-rose-500">*</span></Label>
              <Input
                id="upload-file"
                type="file"
                accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg,.json"
                onChange={e => {
                  const selectedFile = e.target.files?.[0] ?? null
                  setFile(selectedFile)
                  const derived = selectedFile?.name
                    .replace(/\.[^.]+$/, '')
                    .replace(/[-_]+/g, ' ')
                    .replace(/^./, c => c.toUpperCase())
                  if (derived && !title) setTitle(derived)
                }}
              />
              <p className="text-xs text-slate-400">PDF, DOCX, PPTX, TXT, PNG, JPG, JSON · Max 50 MB</p>
              {file && (
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  ✓ {file.name} ({fileSize(file.size)})
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button disabled={uploading || !file || !title.trim()} onClick={() => void handleUpload()}>
              {uploading ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Uploading…</> : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface ResourceCardProps {
  item: Resource
  downloadingId: string
  onDownload: (id: string) => void
  onTest: (id: string) => void
}

function ResourceCard({ item, downloadingId, onDownload, onTest }: ResourceCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      {/* Top */}
      <div>
        <div className="flex items-start gap-2">
          {fileIcon(item.file_type)}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
            <p className="text-xs text-slate-500">{categoryLabel(item.category)}</p>
          </div>
        </div>
        {item.description && (
          <p className="mt-2 line-clamp-2 text-xs text-slate-500">{item.description}</p>
        )}
      </div>

      {/* Bottom */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-slate-400">{item.file_type.toUpperCase()} · {fileSize(item.file_size)}</span>
          <span className="text-xs text-slate-400">{item.download_count} downloads</span>
        </div>

        {item.file_type === 'json' ? (
          <Button
            size="sm"
            onClick={() => onTest(item.id)}
          >
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />Take Test
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={downloadingId === item.id}
            onClick={() => onDownload(item.id)}
          >
            {downloadingId === item.id
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <Download className="mr-1.5 h-3.5 w-3.5" />}
            Download
          </Button>
        )}
      </div>
    </div>
  )
}
