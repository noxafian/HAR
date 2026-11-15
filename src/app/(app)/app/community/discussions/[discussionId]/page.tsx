'use client'

import { useEffect, use, useState } from 'react'
import { ArrowLeft, Send, User, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ROUTE_PATHS } from '@/lib/constants'
import { apiRequest, jsonBody } from '@/lib/client/api'

interface Thread { id: string; title: string; body: string; subject_name: string; author_name: string; reply_count: number; created_at: string }
interface Reply { id: string; author_name: string; body: string; created_at: string }
export default function DiscussionDetailPage({ params }: { params: Promise<{ discussionId: string }> }) {
  const { discussionId } = use(params)
  const [discussion, setDiscussion] = useState<Thread | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function loadThread() {
    setLoading(true); setError('')
    try { const result = await apiRequest<{ discussion: Thread; replies: Reply[] }>(`/api/v1/community/discussions/${discussionId}`); setDiscussion(result.discussion); setReplies(result.replies) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load discussion') }
    finally { setLoading(false) }
  }
  useEffect(() => { void loadThread() }, [discussionId])
  async function handlePostReply() {
    if (replyText.trim().length < 5 || saving) return
    setSaving(true); setError('')
    try { await apiRequest(`/api/v1/community/discussions/${discussionId}/replies`, { method: 'POST', body: jsonBody({ body: replyText.trim() }) }); setReplyText(''); await loadThread() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not post reply') }
    finally { setSaving(false) }
  }
  return <div className="mx-auto max-w-3xl space-y-6">
    <div className="flex items-center gap-3"><Link href={ROUTE_PATHS.community}><Button variant="ghost" size="icon" aria-label="Back to community"><ArrowLeft className="h-4 w-4"/></Button></Link><div><h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Discussion Thread</h1><p className="text-xs text-slate-400">{discussionId}</p></div></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    {loading ? <div className="flex justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading thread…</div> : discussion ? <><Card><CardContent className="p-6"><div className="mb-3 flex items-center gap-2"><Badge variant="outline">{discussion.subject_name}</Badge><span className="text-xs text-slate-400">Posted by {discussion.author_name} · {new Date(discussion.created_at).toLocaleString()}</span></div><h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{discussion.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{discussion.body}</p></CardContent></Card>
      <div className="space-y-4"><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Replies ({replies.length})</h3>{replies.length ? replies.map(reply => <div key={reply.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="mb-2 flex items-center gap-2 text-xs text-slate-500"><User className="h-3.5 w-3.5"/><span className="font-semibold text-slate-800 dark:text-slate-200">{reply.author_name}</span><span>· {new Date(reply.created_at).toLocaleString()}</span></div><p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">{reply.body}</p></div>) : <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">No replies yet. Add the first helpful response.</p>}</div>
      <Card><CardContent className="space-y-3 p-5"><Label htmlFor="reply-content" className="text-sm font-semibold">Contribute to discussion</Label><Textarea id="reply-content" placeholder="Write your explanation or solution approach…" rows={4} value={replyText} onChange={e => setReplyText(e.target.value)}/><div className="flex justify-end"><Button onClick={() => void handlePostReply()} disabled={saving || replyText.trim().length < 5}>{saving ? 'Posting…' : <><Send className="mr-1.5 h-4 w-4"/>Post Reply</>}</Button></div></CardContent></Card>
    </> : <p className="py-12 text-center text-sm text-slate-500">This discussion could not be found or is no longer available.</p>}
  </div>
}
