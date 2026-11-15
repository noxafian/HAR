'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Upload, Library, Download, Loader2, FileText, RefreshCw, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { apiRequest, jsonBody } from '@/lib/client/api'
import { CS_SUBJECTS, DA_SUBJECTS } from '@/lib/constants'

interface Resource { id: string; title: string; description: string | null; paper: 'CS' | 'DA' | 'GA' | null; file_type: string; file_size: number; status: string; download_count: number; created_at: string; subjects?: { name: string } | { name: string }[] | null; topics?: { name: string } | { name: string }[] | null }
function relationName(value: Resource['subjects']): string { return Array.isArray(value) ? value[0]?.name ?? 'General' : value?.name ?? 'General' }

export default function LibraryPage() {
  const router = useRouter()
  const [resources, setResources] = useState<Resource[]>([])
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [paper, setPaper] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('')
  const [uploadPaper, setUploadPaper] = useState<'CS' | 'DA' | 'GA'>('CS')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [downloadingId, setDownloadingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadResources(filters = { search, type, paper }) {
    setLoading(true); setError('')
    try {
      const query = new URLSearchParams({ limit: '100' })
      if (filters.search.trim()) query.set('search', filters.search.trim())
      if (filters.type) query.set('type', filters.type)
      if (filters.paper) query.set('paper', filters.paper)
      const result = await apiRequest<{ items: Resource[] }>(`/api/v1/library?${query.toString()}`)
      setResources(result.items)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load resources') }
    finally { setLoading(false) }
  }
  useEffect(() => { void loadResources() }, [])

  async function handleUpload() {
    if (!file || !title.trim() || uploading) return
    setUploading(true); setError(''); setMessage('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title.trim())
      if (description.trim()) formData.append('description', description.trim())
      if (subject) formData.append('subject', subject)
      if (topic.trim()) formData.append('topic', topic.trim())
      formData.append('paper', uploadPaper)
      
      const result = await apiRequest<{ resourceId: string; status: string; duplicate?: boolean }>('/api/v1/library/upload', { method: 'POST', body: formData })
      setMessage(result.duplicate ? 'This file already exists in the library.' : 'Upload successful. File is now available to all members.')
      setUploadOpen(false); setFile(null); setTitle(''); setDescription(''); setSubject(''); setTopic(''); setUploadPaper('CS')
      await loadResources()
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed') }
    finally { setUploading(false) }
  }

  async function downloadResource(id: string) {
    setDownloadingId(id); setError('')
    try {
      const result = await apiRequest<{ downloadUrl: string }>('/api/v1/library/' + id + '/download')
      window.location.assign(result.downloadUrl)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create download link') }
    finally { setDownloadingId('') }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Study Library</h1><p className="mt-1 text-sm text-slate-500">Shared study resources. Upload files to share with the group.</p></div><Button onClick={() => setUploadOpen(true)}><Upload className="mr-1.5 h-4 w-4"/>Upload Resource</Button></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}{message && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</div>}
    <div className="flex flex-wrap gap-3"><div className="relative min-w-48 flex-1"><Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><Input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void loadResources() }} placeholder="Search resources…" className="pl-8" aria-label="Search resources"/></div><Select aria-label="Filter by examination" value={paper} onChange={e => { const next = e.target.value; setPaper(next); void loadResources({ search, type, paper: next }) }}><option value="">All examinations</option><option value="CS">GATE CS</option><option value="DA">GATE DA</option><option value="GA">General Aptitude</option></Select><Select aria-label="Filter by type" value={type} onChange={e => { const next = e.target.value; setType(next); void loadResources({ search, type: next, paper }) }}><option value="">All types</option><option value="pdf">PDF</option><option value="docx">DOCX</option><option value="pptx">PPTX</option><option value="png">PNG</option><option value="jpg">JPG</option><option value="jpeg">JPEG</option><option value="txt">TXT</option><option value="json">JSON</option></Select><Button variant="outline" size="icon" onClick={() => void loadResources()} aria-label="Refresh resources"><RefreshCw className="h-4 w-4"/></Button></div>
    {loading ? <div className="flex justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading library…</div> : resources.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700"><Library className="mx-auto h-8 w-8 text-slate-400"/><h2 className="mt-3 font-semibold text-slate-800 dark:text-slate-200">No resources found</h2><p className="mt-1 text-sm text-slate-500">Verified group resources and your pending uploads will appear here.</p><Button className="mt-4" onClick={() => setUploadOpen(true)}><Upload className="mr-1.5 h-4 w-4"/>Upload Resource</Button></div> : <div className="grid gap-3 sm:grid-cols-2">{resources.map(item => <article key={item.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div><div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><FileText className="h-5 w-5 shrink-0 text-indigo-500"/><h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</h2></div><Badge variant={item.status === 'verified' ? 'success' : item.status === 'pending' ? 'warning' : 'secondary'}>{item.status}</Badge></div><p className="mt-2 line-clamp-2 text-xs text-slate-500">{item.description || 'No description provided.'}</p><p className="mt-3 text-xs text-slate-500">{item.paper ?? 'Unclassified'} · {relationName(item.subjects)} · {item.file_type.toUpperCase()} · {(item.file_size / 1048576).toFixed(1)} MB</p></div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800"><span>{item.download_count} downloads</span>{item.file_type === 'json' ? <Button size="sm" variant="outline" disabled={item.status !== 'verified'} onClick={() => router.push('/app/library/' + item.id + '/test')}><BookOpen className="mr-1.5 h-3.5 w-3.5"/>Take Test</Button> : <Button size="sm" variant="outline" disabled={item.status !== 'verified' || downloadingId === item.id} onClick={() => void downloadResource(item.id)}>{downloadingId === item.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <Download className="mr-1.5 h-3.5 w-3.5"/>}Download</Button>}</div></article>)}</div>}
    <Dialog open={uploadOpen} onOpenChange={setUploadOpen}><DialogContent><DialogHeader><DialogTitle>Upload Resource</DialogTitle><DialogDescription>Upload a file to share with all group members. It will be available immediately.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="flex flex-col gap-1.5"><Label htmlFor="resource-paper">Paper / section</Label><Select id="resource-paper" value={uploadPaper} onChange={e => { setUploadPaper(e.target.value as 'CS' | 'DA' | 'GA'); setSubject(''); setTopic('') }}><option value="CS">GATE CS</option><option value="DA">GATE DA</option><option value="GA">General Aptitude</option></Select></div><div className="flex flex-col gap-1.5"><Label htmlFor="resource-title">Title</Label><Input id="resource-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Operating Systems — Complete Notes"/></div><div className="flex flex-col gap-1.5"><Label htmlFor="resource-description">Description</Label><Textarea id="resource-description" value={description} onChange={e => setDescription(e.target.value)} maxLength={2000}/></div><div className="flex flex-col gap-1.5"><Label htmlFor="resource-subject">Subject</Label><Select id="resource-subject" value={subject} onChange={e => setSubject(e.target.value)}><option value="">Uncategorised</option>{(uploadPaper === 'CS' ? CS_SUBJECTS : uploadPaper === 'DA' ? DA_SUBJECTS : [{ id: 'ga-general', name: 'General Aptitude', order: 1 }]).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</Select></div><div className="flex flex-col gap-1.5"><Label htmlFor="resource-topic">Topic (optional)</Label><Input id="resource-topic" value={topic} onChange={e => setTopic(e.target.value)} placeholder="Existing syllabus topic"/></div><div className="flex flex-col gap-1.5"><Label htmlFor="resource-file">File</Label><Input id="resource-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.pptx,.txt" onChange={e => setFile(e.target.files?.[0] ?? null)}/><p className="text-xs text-slate-500">PDF, PNG, JPG, DOCX, PPTX, TXT · Maximum 50 MB. Stored privately on Supabase Storage.</p>{file && <p className="text-xs text-slate-600 dark:text-slate-300">Selected: {file.name} ({(file.size / 1048576).toFixed(2)} MB)</p>}</div></div><DialogFooter><DialogClose><Button variant="outline">Cancel</Button></DialogClose><Button disabled={uploading || !file || !title.trim()} onClick={() => void handleUpload()}>{uploading ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin"/>Uploading…</> : 'Upload'}</Button></DialogFooter></DialogContent></Dialog>
  </div>
}
