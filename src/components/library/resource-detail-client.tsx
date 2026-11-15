'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, FileText, Loader2, ShieldCheck, Clock, User, AlertCircle } from 'lucide-react'
import { apiRequest } from '@/lib/client/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface ResourceDetail {
  id: string
  title: string
  description: string | null
  paper: string | null
  file_type: string
  file_size: number
  status: 'pending' | 'verified' | 'rejected' | 'unverified'
  uploaded_by: string
  verified_by: string | null
  verified_at: string | null
  version: number
  download_count: number
  created_at: string
  updated_at: string
  subjects?: { name: string } | { name: string }[] | null
  topics?: { name: string } | { name: string }[] | null
}
interface DownloadResponse { downloadUrl: string }

function relationName(value: ResourceDetail['subjects'] | ResourceDetail['topics']) {
  return Array.isArray(value) ? value[0]?.name ?? '—' : value?.name ?? '—'
}

export function ResourceDetailClient({ resourceId }: { resourceId: string }) {
  const [resource, setResource] = useState<ResourceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    apiRequest<ResourceDetail>(`/api/v1/library/${resourceId}`)
      .then(value => { if (active) setResource(value) })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Resource could not be loaded') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [resourceId])

  async function download() {
    if (!resource || resource.status !== 'verified' || downloading) return
    setDownloading(true)
    setError('')
    try {
      const result = await apiRequest<DownloadResponse>(`/api/v1/library/${resource.id}/download`)
      window.location.assign(result.downloadUrl)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Download could not be started')
    } finally {
      setDownloading(false)
    }
  }

  return <div className="space-y-6">
    <div className="flex items-center gap-3"><Link href="/app/library"><Button variant="ghost" size="icon" aria-label="Back to library"><ArrowLeft className="h-4 w-4"/></Button></Link><div><h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Resource details</h1><p className="text-xs text-slate-500">Metadata is retrieved from the resource record.</p></div></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
    {loading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading resource…</div> : !resource ? <Card><CardContent className="p-8 text-center"><AlertCircle className="mx-auto h-8 w-8 text-slate-400"/><p className="mt-3 text-sm font-medium">Resource not found or not accessible.</p></CardContent></Card> : <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2"><CardHeader><CardTitle className="flex items-start justify-between gap-3"><span className="flex items-center gap-2 text-base"><FileText className="h-5 w-5 text-indigo-500"/>{resource.title}</span><Badge variant={resource.status === 'verified' ? 'success' : resource.status === 'pending' ? 'warning' : 'secondary'}>{resource.status}</Badge></CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-slate-600 dark:text-slate-300">{resource.description || 'No description provided.'}</p><div className="flex flex-wrap gap-2 text-xs"><Badge variant="outline">{resource.paper ?? 'Unclassified'}</Badge><Badge variant="outline">{resource.file_type.toUpperCase()}</Badge><Badge variant="outline">{(resource.file_size / 1048576).toFixed(2)} MB</Badge><Badge variant="outline">Version {resource.version}</Badge></div><Separator/><div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700"><FileText className="mb-2 h-6 w-6 text-slate-400"/>A browser preview is not provided for this file type. Download the file to view it.</div>{resource.status === 'verified' ? <Button onClick={() => void download()} disabled={downloading}>{downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}Download file</Button> : <p className="text-sm text-amber-700 dark:text-amber-300">This resource is not verified yet, so downloads are restricted.</p>}</CardContent></Card>
      <div className="space-y-4"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-slate-400"/>Resource metadata</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div><p className="text-xs text-slate-500">Subject</p><p>{relationName(resource.subjects)}</p></div><div><p className="text-xs text-slate-500">Topic</p><p>{relationName(resource.topics)}</p></div><Separator/><div className="flex items-center gap-2"><User className="h-4 w-4 text-slate-400"/><span className="text-xs text-slate-500">Uploader ID: {resource.uploaded_by}</span></div><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400"/><span className="text-xs text-slate-500">Uploaded {new Date(resource.created_at).toLocaleString()}</span></div><div className="text-xs text-slate-500">{resource.download_count} downloads</div>{resource.verified_at && <div className="text-xs text-slate-500">Verified {new Date(resource.verified_at).toLocaleString()}</div>}</CardContent></Card></div>
    </div>}
  </div>
}
