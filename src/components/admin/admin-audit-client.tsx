'use client'

import { FormEvent,useCallback,useEffect,useState } from 'react'
import { apiRequest } from '@/lib/client/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Shield, Search, RefreshCw, AlertCircle, FileText } from 'lucide-react'

type AuditEvent={id:string;action:string;actor_id:string|null;actor_name:string|null;resource_type:string;resource_id:string;status:'success'|'failure';error_message:string|null;metadata:Record<string,unknown>;created_at:string}
type AuditPage={items:AuditEvent[];page:number;limit:number;hasMore:boolean}
export function AdminAuditClient(){const [data,setData]=useState<AuditPage|null>(null);const [search,setSearch]=useState('');const [applied,setApplied]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(true)
 const load=useCallback(async(term=applied)=>{setLoading(true);setError('');try{const q=new URLSearchParams({page:'1',limit:'100'});if(term)q.set('search',term);setData(await apiRequest<AuditPage>(`/api/v1/admin/audit?${q}`))}catch(e){setError(e instanceof Error?e.message:'Audit events could not be loaded')}finally{setLoading(false)}},[applied]);useEffect(()=>{void load('')},[load])
 function submit(e:FormEvent){e.preventDefault();setApplied(search.trim());void load(search.trim())}
 return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-bold">Audit Log</h1><p className="mt-1 text-muted-foreground">Recent persisted security, membership, upload and moderation events.</p></div><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div>
 <Card className="p-4"><form className="flex gap-2" onSubmit={submit}><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search action, resource, member or ID"/><Button type="submit" variant="outline"><Search className="h-4 w-4"/></Button></form><p className="mt-2 text-xs text-muted-foreground">First 100 matching events. IP addresses, object keys and credential material are not returned by this view.</p></Card>
 {error&&<p role="alert" className="text-sm text-destructive"><AlertCircle className="mr-1 inline h-4 w-4"/>{error}</p>}
 <Card className="p-5">{loading&&!data?<p className="text-sm text-muted-foreground">Loading audit events…</p>:!data?.items.length?<EmptyState icon={Shield} title="No audit events found" description="Recorded administrative and user actions will appear here."/>:<div className="space-y-3">{data.items.map(event=><div key={event.id} className="flex gap-3 rounded-lg border p-4"><div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"><FileText className="h-4 w-4"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{event.action}</Badge><Badge variant={event.status==='success'?'secondary':'destructive'}>{event.status}</Badge></div><p className="mt-2 text-sm"><b>{event.actor_name??'System / deleted account'}</b> · {event.resource_type} · {event.resource_id}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString('en-IN')} · Event ID {event.id}</p>{event.error_message&&<p className="mt-2 whitespace-pre-wrap text-sm text-destructive">{event.error_message}</p>}{Object.keys(event.metadata??{}).length>0&&<details className="mt-2"><summary className="cursor-pointer text-xs text-muted-foreground">Metadata</summary><pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">{JSON.stringify(event.metadata,null,2)}</pre></details>}</div></div>)}</div>}</Card>
 </div>
}
