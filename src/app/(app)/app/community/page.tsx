'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Megaphone, MessageSquare, Trophy, Plus, MessageCircle, Pin, User, Loader2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { CS_SUBJECTS, DA_SUBJECTS, ROUTE_PATHS } from '@/lib/constants'
import { apiRequest, jsonBody } from '@/lib/client/api'

interface Discussion { id: string; title: string; body: string; author_name: string; subject_name: string; reply_count: number; is_pinned: boolean; created_at: string }
interface Announcement { id: string; title: string; body: string; author_name: string; is_pinned: boolean; created_at: string }

export default function CommunityPage() {
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [newDiscOpen, setNewDiscOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('Operating Systems')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadCommunity() {
    setLoading(true); setError('')
    try {
      const [discussionResult, announcementResult] = await Promise.all([
        apiRequest<{ items: Discussion[] }>('/api/v1/community/discussions?limit=50'),
        apiRequest<{ items: Announcement[] }>('/api/v1/community/announcements'),
      ])
      setDiscussions(discussionResult.items); setAnnouncements(announcementResult.items)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load community') }
    finally { setLoading(false) }
  }
  useEffect(() => { void loadCommunity() }, [])

  async function handleCreateDiscussion() {
    if (!title.trim() || content.trim().length < 10 || saving) return
    setSaving(true); setError('')
    try {
      await apiRequest('/api/v1/community/discussions', { method: 'POST', body: jsonBody({ title: title.trim(), body: content.trim(), subject, category: 'doubt' }) })
      setTitle(''); setContent(''); setNewDiscOpen(false); await loadCommunity()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not publish discussion') }
    finally { setSaving(false) }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Community Workspace</h1><p className="mt-1 text-sm text-slate-500">Collaborative doubt clearing and verified platform announcements.</p></div><Button onClick={() => setNewDiscOpen(true)}><Plus className="mr-1.5 h-4 w-4"/>New Discussion</Button></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
    {loading ? <div className="flex justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading community…</div> : <Tabs defaultValue="discussions"><TabsList className="flex-wrap"><TabsTrigger value="discussions"><MessageSquare className="mr-1.5 h-3.5 w-3.5"/>Doubt Discussions ({discussions.length})</TabsTrigger><TabsTrigger value="announcements"><Megaphone className="mr-1.5 h-3.5 w-3.5"/>Announcements ({announcements.length})</TabsTrigger><TabsTrigger value="challenges"><Trophy className="mr-1.5 h-3.5 w-3.5"/>Challenges</TabsTrigger></TabsList>
      <TabsContent value="discussions">{discussions.length ? <div className="space-y-3">{discussions.map(disc => <div key={disc.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><div className="mb-1.5 flex items-center gap-2">{disc.is_pinned && <Badge variant="warning" className="flex items-center gap-1 text-[10px]"><Pin className="h-3 w-3"/>Pinned</Badge>}<Badge variant="outline">{disc.subject_name}</Badge></div><Link href={ROUTE_PATHS.discussion(disc.id)} className="text-base font-semibold text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400">{disc.title}</Link><p className="mt-2 line-clamp-2 text-sm text-slate-500">{disc.body}</p></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800"><span className="flex items-center gap-1"><User className="h-3.5 w-3.5"/>{disc.author_name} · {new Date(disc.created_at).toLocaleString()}</span><Link href={ROUTE_PATHS.discussion(disc.id)} className="flex items-center gap-1 font-semibold text-indigo-600 hover:underline dark:text-indigo-400"><MessageCircle className="h-3.5 w-3.5"/>{disc.reply_count} Replies</Link></div></div>)}</div> : <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700"><MessageSquare className="mx-auto h-8 w-8 text-slate-400"/><h2 className="mt-3 font-semibold text-slate-800 dark:text-slate-200">No discussions yet</h2><p className="mt-1 text-sm text-slate-500">Start the first discussion for your study group.</p><Button className="mt-4" onClick={() => setNewDiscOpen(true)}>Start a Discussion</Button></div>}</TabsContent>
      <TabsContent value="announcements">{announcements.length ? <div className="space-y-3">{announcements.map(item => <article key={item.id} className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5 dark:border-indigo-800 dark:bg-indigo-950/30"><div className="mb-2 flex items-center gap-2">{item.is_pinned && <Badge variant="warning">Pinned</Badge>}<Badge>Platform Notice</Badge><span className="text-xs text-slate-500">{item.author_name} · {new Date(item.created_at).toLocaleDateString()}</span></div><h3 className="font-bold text-slate-900 dark:text-slate-100">{item.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{item.body}</p></article>)}</div> : <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">No active announcements.</div>}</TabsContent>
      <TabsContent value="challenges"><div className="rounded-xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700"><Trophy className="mx-auto h-8 w-8 text-slate-400"/><h2 className="mt-3 font-semibold text-slate-800 dark:text-slate-200">No active challenges</h2><p className="mt-1 text-sm text-slate-500">Question-of-the-day and group challenges will appear here when published.</p><Link href={ROUTE_PATHS.pyq} className="mt-4 inline-block"><Button variant="outline">Open PYQ Practice</Button></Link></div></TabsContent>
    </Tabs>}
    <Dialog open={newDiscOpen} onOpenChange={setNewDiscOpen}><DialogContent><DialogHeader><DialogTitle>Start a Group Discussion</DialogTitle><DialogDescription>Post a doubt or subject discussion for approved group members.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="flex flex-col gap-1.5"><Label htmlFor="disc-title">Discussion Title</Label><Input id="disc-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Doubt in Bellman-Ford negative cycle detection"/></div><div className="flex flex-col gap-1.5"><Label htmlFor="disc-subject">Subject</Label><Select id="disc-subject" value={subject} onChange={e => setSubject(e.target.value)}>{[...CS_SUBJECTS, ...DA_SUBJECTS].map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</Select></div><div className="flex flex-col gap-1.5"><Label htmlFor="disc-content">Problem Description / Question</Label><Textarea id="disc-content" rows={5} value={content} onChange={e => setContent(e.target.value)} placeholder="Provide the question context, formulas, or reasoning…"/></div></div><DialogFooter><DialogClose><Button variant="outline">Cancel</Button></DialogClose><Button disabled={saving || !title.trim() || content.trim().length < 10} onClick={() => void handleCreateDiscussion()}>{saving ? 'Publishing…' : 'Publish Discussion'}</Button></DialogFooter></DialogContent></Dialog>
  </div>
}
