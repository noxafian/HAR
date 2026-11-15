'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest, jsonBody } from '@/lib/client/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/select'
import { UserCheck, User, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'

type JoinRequest = { request_id: string; user_id: string; email: string; display_name: string; message: string|null; requested_at: string }
type PageData = { items: JoinRequest[]; total: number; page: number; limit: number; hasMore: boolean }
type Summary = { joinRequests: {pending:number;approved:number;rejected:number} }
export function AdminJoinRequestsClient() {
  const [data,setData]=useState<PageData|null>(null);const [summary,setSummary]=useState<Summary|null>(null);const [busy,setBusy]=useState('');const [error,setError]=useState('');const [notice,setNotice]=useState('')
  const load=useCallback(async()=>{setError('');try{const [requests,stats]=await Promise.all([apiRequest<PageData>('/api/v1/membership/requests?page=1&limit=100'),apiRequest<Summary>('/api/v1/admin/summary')]);setData(requests);setSummary(stats)}catch(e){setError(e instanceof Error?e.message:'Join requests could not be loaded')}},[])
  useEffect(()=>{void load()},[load])
  async function respond(item:JoinRequest,decision:'approve'|'reject'){setBusy(item.request_id);setError('');setNotice('');try{const url=`/api/v1/membership/requests/${item.request_id}/${decision}`;await apiRequest(url,{method:'POST',body:jsonBody(decision==='approve'?{role:'member'}:{})});setNotice(`${item.display_name}'s request was ${decision==='approve'?'approved':'rejected'}.`);await load()}catch(e){setError(e instanceof Error?e.message:`Could not ${decision} request`)}finally{setBusy('')}}
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-bold">Join Requests</h1><p className="mt-1 text-muted-foreground">Review membership applications. Approval updates membership atomically.</p></div><Button variant="outline" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div>
    <div className="grid gap-4 sm:grid-cols-3">{[{label:'Pending',value:summary?.joinRequests.pending,icon:Clock},{label:'Approved',value:summary?.joinRequests.approved,icon:CheckCircle},{label:'Rejected',value:summary?.joinRequests.rejected,icon:XCircle}].map(({label,value,icon:Icon})=><Card key={label} className="p-4"><div className="flex items-center gap-3"><Icon className="h-7 w-7 text-muted-foreground"/><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value??'—'}</p></div></div></Card>)}</div>
    {error&&<p role="alert" className="text-sm text-destructive"><AlertCircle className="mr-1 inline h-4 w-4"/>{error}</p>}{notice&&<p role="status" className="text-sm text-green-700">{notice}</p>}
    <Card className="p-5"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Pending applications</h2><p className="text-sm text-muted-foreground">{data?`${data.total} pending requests`:'Loading…'}</p></div></div>
      {!data&&!error?<p className="text-sm text-muted-foreground">Loading join requests…</p>:!data?.items.length?<EmptyState icon={UserCheck} title="No pending requests" description="New membership applications will appear here."/>:<div className="space-y-3">{data.items.map(item=><div key={item.request_id} className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-start md:justify-between"><div className="flex min-w-0 gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"><User className="h-5 w-5"/></div><div className="min-w-0"><p className="font-medium">{item.display_name}</p><p className="truncate text-sm text-muted-foreground">{item.email}</p><p className="mt-1 text-xs text-muted-foreground">Requested {new Date(item.requested_at).toLocaleString('en-IN')}</p>{item.message&&<p className="mt-3 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{item.message}</p>}<p className="mt-2 text-xs text-muted-foreground">Account: {item.user_id}</p></div></div><div className="flex shrink-0 gap-2"><Button variant="outline" disabled={busy===item.request_id} onClick={()=>void respond(item,'reject')}><XCircle className="mr-1 h-4 w-4"/>Reject</Button><Button disabled={busy===item.request_id} onClick={()=>void respond(item,'approve')}><CheckCircle className="mr-1 h-4 w-4"/>Approve</Button></div></div>)}</div>}</Card>
    <p className="text-xs text-muted-foreground">Only the owner can approve or reject membership requests.</p>
  </div>
}
