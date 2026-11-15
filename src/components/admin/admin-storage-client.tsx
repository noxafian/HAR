'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '@/lib/client/api'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { HardDrive, FileText, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Breakdown={fileType:string;count:number;bytes:number}
type LargeFile={id:string;title:string;paper:string;fileType:string;fileSize:number;createdAt:string}
type Storage={totalCount:number;totalBytes:number;pendingCount:number;breakdown:Breakdown[];largestFiles:LargeFile[];scope:string}
const formatBytes=(n:number)=>{if(!n)return'0 B';const units=['B','KB','MB','GB','TB'];const i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),4);return`${(n/1024**i).toFixed(2)} ${units[i]}`}
export function AdminStorageClient(){const [data,setData]=useState<Storage|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const load=useCallback(async()=>{setLoading(true);setError('');try{setData(await apiRequest<Storage>('/api/v1/admin/storage'))}catch(e){setError(e instanceof Error?e.message:'Storage summary unavailable')}finally{setLoading(false)}},[]);useEffect(()=>{void load()},[load])
 return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-bold">Storage Management</h1><p className="mt-1 text-muted-foreground">Usage calculated from active resource records.</p></div><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div>
 {error&&<p role="alert" className="text-sm text-destructive"><AlertCircle className="mr-1 inline h-4 w-4"/>{error}</p>}
 <div className="grid gap-4 sm:grid-cols-3"><Card className="p-5"><p className="text-sm text-muted-foreground">Tracked resources</p><p className="mt-2 text-2xl font-bold">{data?.totalCount??'—'}</p></Card><Card className="p-5"><p className="text-sm text-muted-foreground">Database-tracked bytes</p><p className="mt-2 text-2xl font-bold">{data?formatBytes(Number(data.totalBytes)):'—'}</p></Card><Card className="p-5"><p className="text-sm text-muted-foreground">Awaiting moderation</p><p className="mt-2 text-2xl font-bold">{data?.pendingCount??'—'}</p></Card></div>
 <Card className="p-5"><h2 className="mb-4 text-lg font-semibold">Tracked usage by file type</h2>{loading&&!data?<p className="text-sm text-muted-foreground">Loading…</p>:!data?.breakdown.length?<EmptyState icon={HardDrive} title="No tracked files" description="Verified and pending resource uploads will be reflected here."/>:<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{data.breakdown.map(item=><div key={item.fileType} className="rounded-lg border p-4"><div className="flex items-center justify-between"><FileText className="h-5 w-5 text-muted-foreground"/><Badge variant="outline">{item.count}</Badge></div><p className="mt-3 text-sm text-muted-foreground">{item.fileType.toUpperCase()}</p><p className="mt-1 text-xl font-semibold">{formatBytes(Number(item.bytes))}</p></div>)}</div>}</Card>
 <Card className="p-5"><h2 className="mb-4 text-lg font-semibold">Largest tracked files</h2>{!data?.largestFiles.length?<EmptyState icon={HardDrive} title="No files to display" description="The largest active resource records will appear here."/>:<div className="space-y-2">{data.largestFiles.map(file=><div key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"><div><p className="font-medium">{file.title}</p><p className="text-xs text-muted-foreground">{file.paper} · {file.fileType} · {new Date(file.createdAt).toLocaleDateString('en-IN')}</p></div><span className="text-sm font-semibold">{formatBytes(Number(file.fileSize))}</span></div>)}</div>}</Card>
 <p className="rounded-md border p-3 text-sm text-muted-foreground">{data?.scope??'Storage totals are not available.'} This is not a Cloudflare R2 account quota, bucket inventory or provider billing measurement; those values are not currently exposed by this application.</p>
 </div>
}
