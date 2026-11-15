'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertCircle, Trash2, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { apiRequest, jsonBody } from '@/lib/client/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import type { AdminDiscussion, AdminDiscussionListResponse, AdminReply } from '@/types/admin-community'

type Tab = 'discussions' | 'replies'

export function AdminCommunityClient() {
  const [tab, setTab] = useState<Tab>('discussions')
  const [discussions, setDiscussions] = useState<AdminDiscussion[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Expanded discussion state
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [replies, setReplies] = useState<AdminReply[]>([])
  const [repliesLoading, setRepliesLoading] = useState(false)

  const load = useCallback(async (searchTerm?: string) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.set('search', searchTerm)
      const res = await apiRequest<AdminDiscussionListResponse>(`/api/v1/admin/community/discussions?${params}`)
      setDiscussions(res.items)
      setTotal(res.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load discussions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSearch() {
    setSearch(searchInput)
    await load(searchInput)
  }

  async function handleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    setRepliesLoading(true)
    try {
      const res = await apiRequest<{ items: AdminReply[] }>(`/api/v1/admin/community/discussions/${id}/replies`)
      setReplies(res.items)
    } catch {
      setReplies([])
    } finally {
      setRepliesLoading(false)
    }
  }

  async function handleDeleteDiscussion(id: string) {
    if (!confirm('Soft-delete this discussion and its replies?')) return
    try {
      await apiRequest(`/api/v1/admin/community/discussions?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      await load(search || undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete')
    }
  }

  async function handleDeleteReply(id: string) {
    if (!confirm('Delete this reply?')) return
    try {
      await apiRequest(`/api/v1/admin/community/replies/${id}`, { method: 'DELETE', body: jsonBody({}) })
      if (expandedId) {
        const res = await apiRequest<{ items: AdminReply[] }>(`/api/v1/admin/community/discussions/${expandedId}/replies`)
        setReplies(res.items)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete reply')
    }
  }

  const recentReplies = discussions
    .filter(d => d.reply_count > 0)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Community Moderation</h1>
        <p className="mt-1 text-muted-foreground">Review and moderate discussions and replies.</p>
      </div>

      {error && <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {(['discussions', 'replies'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${tab === t ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t === 'discussions' ? `Discussions (${total})` : 'Recent Activity'}
          </button>
        ))}
      </div>

      {tab === 'discussions' && (
        <>
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
                placeholder="Search discussions…"
                className="pl-8"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleSearch}>Search</Button>
            {search && <Button variant="ghost" size="sm" onClick={() => { setSearchInput(''); setSearch(''); load() }}>Clear</Button>}
          </div>

          <Card className="overflow-hidden">
            {loading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
            {!loading && discussions.length === 0 && <div className="p-4 text-sm text-muted-foreground">No discussions found.</div>}
            {!loading && discussions.map(d => (
              <div key={d.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div className="flex items-start gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${d.is_deleted ? 'line-through text-muted-foreground' : ''}`}>{d.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="outline">{d.category}</Badge>
                      <Badge variant="secondary">{d.reply_count} replies</Badge>
                      {d.is_pinned && <Badge>Pinned</Badge>}
                      {d.is_deleted && <Badge variant="destructive">Deleted</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{d.author_name} · {new Date(d.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => handleExpand(d.id)} aria-label="Toggle replies" aria-expanded={expandedId === d.id}>
                      {expandedId === d.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    {!d.is_deleted && (
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteDiscussion(d.id)} aria-label="Delete discussion">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
                {expandedId === d.id && (
                  <div className="px-4 pb-4 bg-slate-50 dark:bg-slate-800/50">
                    {repliesLoading && <p className="text-xs text-muted-foreground py-2">Loading replies…</p>}
                    {!repliesLoading && replies.length === 0 && <p className="text-xs text-muted-foreground py-2">No replies.</p>}
                    {!repliesLoading && replies.map(r => (
                      <div key={r.id} className="flex items-start gap-2 py-2 border-t border-slate-200 dark:border-slate-700 first:border-0">
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs ${r.is_deleted ? 'line-through text-muted-foreground' : ''}`}>{r.body.slice(0, 200)}{r.body.length > 200 ? '…' : ''}</p>
                          <p className="text-xs text-muted-foreground">{r.author_name} · {new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                        {!r.is_deleted && (
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteReply(r.id)} aria-label="Delete reply">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Card>
        </>
      )}

      {tab === 'replies' && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-semibold">Most Active Discussions (last 20 by reply count)</h2>
          </div>
          {recentReplies.length === 0 && <div className="p-4 text-sm text-muted-foreground">No activity yet.</div>}
          {recentReplies.map(d => (
            <div key={d.id} className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{d.title}</p>
                <p className="text-xs text-muted-foreground">{d.author_name} · {d.reply_count} replies · {new Date(d.created_at).toLocaleDateString()}</p>
              </div>
              <Badge variant="secondary">{d.reply_count}</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
