'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiRequest, ApiClientError, jsonBody } from '@/lib/client/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { Clock, LogOut, CheckCircle } from 'lucide-react'

export function AccessPendingClient({ status, displayName }: { status: string; displayName: string }) {
  const router=useRouter();const [message,setMessage]=useState('I am preparing for GATE and would like to join the collaborative StudyHub workspace.');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [error,setError]=useState('')
  async function submit(){if(message.trim().length<20){setError('Please provide at least 20 characters.');return}setBusy(true);setError('');setNotice('');try{await apiRequest('/api/v1/membership/join-request',{method:'POST',body:jsonBody({message:message.trim()})});setNotice('Your access request has been submitted for owner review.')}catch(e){setError(e instanceof ApiClientError?e.message:'Could not submit access request.')}finally{setBusy(false)}}
  async function logout(){setBusy(true);try{await apiRequest('/api/v1/auth/logout',{method:'POST'})}finally{router.replace('/login');router.refresh()}}
  const wasReviewed=status==='rejected'||status==='removed'
  return <Card><CardHeader><div className="mb-2 flex justify-center"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900"><Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400"/></div></div><CardTitle className="text-center">{wasReviewed?'Request access again':'Access pending'}</CardTitle><CardDescription className="text-center">Hello {displayName}. Your account is registered, but workspace access requires owner approval.</CardDescription></CardHeader><CardContent className="space-y-4 text-center">{notice?<Alert variant="success" title="Request submitted"><CheckCircle className="mr-1 inline h-4 w-4"/>{notice}</Alert>:<><p className="text-sm text-muted-foreground">Current membership status: <b>{status}</b>. You can submit or update your request below. Your email and account name are read from your authenticated account.</p><div className="space-y-2 text-left"><Label htmlFor="request-message">Message to the owner</Label><Textarea id="request-message" rows={4} maxLength={500} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Explain why you would like to join…"/><p className="text-right text-xs text-muted-foreground">{message.length}/500</p></div><Button className="w-full" onClick={()=>void submit()} disabled={busy||message.trim().length<20}>{busy?'Submitting…':'Submit / update access request'}</Button></>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex items-center justify-center gap-4"><Link href="/login" className="text-sm text-muted-foreground hover:underline">Sign in</Link><Button variant="ghost" size="sm" onClick={()=>void logout()} disabled={busy}><LogOut className="mr-1 h-4 w-4"/>Sign out</Button></div></CardContent></Card>
}
