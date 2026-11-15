'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertCircle, Pencil, Trash2, Pin, Eye, EyeOff, Plus } from 'lucide-react'
import { apiRequest, jsonBody } from '@/lib/client/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import type { AdminAnnouncement, CreateAnnouncementBody, PatchAnnouncementBody } from '@/types/admin-announcements'

function emptyForm(): CreateAnnouncementBody {
  return { title: '', body: '', is_pinned: false, published: false }
}

export function AdminAnnouncementsClient() {
  const [items, setItems] = useState<AdminAnnouncement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // New announcement form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateAnnouncementBody>(emptyForm())
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  // Editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<PatchAnnouncementBody>({})
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiRequest<{ items: AdminAnnouncement[] }>('/api/v1/admin/announcements')
      setItems(res.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load announcements')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(publishNow: boolean) {
    setFormError('')
    setFormLoading(true)
    try {
      await apiRequest('/api/v1/admin/announcements', { method: 'POST', body: jsonBody({ ...form, published: publishNow }) })
      setSuccess(publishNow ? 'Announcement published' : 'Announcement saved as draft')
      setForm(emptyForm())
      setShowForm(false)
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not create')
    } finally {
      setFormLoading(false)
    }
  }

  async function handlePatch(id: string, patch: PatchAnnouncementBody) {
    try {
      await apiRequest(`/api/v1/admin/announcements/${id}`, { method: 'PATCH', body: jsonBody(patch) })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update announcement')
    }
  }

  async function handleSaveEdit() {
    if (!editingId) return
    setEditError('')
    setEditLoading(true)
    try {
      await apiRequest(`/api/v1/admin/announcements/${editingId}`, { method: 'PATCH', body: jsonBody(editForm) })
      setSuccess('Updated')
      setEditingId(null)
      await load()
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Could not update')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this announcement?')) return
    try {
      await apiRequest(`/api/v1/admin/announcements/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Announcements</h1>
          <p className="mt-1 text-muted-foreground">Post and manage announcements for students.</p>
        </div>
        <Button size="sm" onClick={() => { setForm(emptyForm()); setShowForm(v => !v) }}>
          <Plus className="h-4 w-4" /> New Announcement
        </Button>
      </div>

      {error && <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}
      {success && <div role="status" className="rounded-md border border-green-400/40 p-3 text-sm text-green-700">{success}</div>}

      {/* New announcement form */}
      {showForm && (
        <Card className="p-5 space-y-3">
          <h2 className="font-semibold">New Announcement</h2>
          {formError && <div role="alert" className="rounded border border-destructive/40 p-2 text-xs text-destructive">{formError}</div>}
          <div>
            <label className="text-xs font-medium">Title (min 5 chars)</label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Announcement title…" />
          </div>
          <div>
            <label className="text-xs font-medium">Body</label>
            <textarea
              className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-sm h-28 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Announcement content…"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Expires at (optional)</label>
            <Input type="datetime-local" value={form.expires_at ?? ''} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value ? new Date(e.target.value).toISOString() : undefined }))} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_pinned ?? false} onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
            Pin this announcement
          </label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="secondary" size="sm" isLoading={formLoading} onClick={() => handleCreate(false)}>Save as Draft</Button>
            <Button size="sm" isLoading={formLoading} onClick={() => handleCreate(true)}>Publish</Button>
          </div>
        </Card>
      )}

      {/* Announcement list */}
      <Card className="overflow-hidden">
        {loading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
        {!loading && items.length === 0 && <div className="p-4 text-sm text-muted-foreground">No announcements yet.</div>}
        {!loading && items.map(item => (
          <div key={item.id} className="border-b border-slate-100 dark:border-slate-800 p-4 last:border-0">
            {editingId === item.id ? (
              <div className="space-y-3">
                {editError && <div role="alert" className="rounded border border-destructive/40 p-2 text-xs text-destructive">{editError}</div>}
                <Input value={editForm.title ?? item.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                <textarea
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-sm h-24 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={editForm.body ?? item.body}
                  onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                  <Button size="sm" isLoading={editLoading} onClick={handleSaveEdit}>Save</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.is_pinned && <Badge variant="default"><Pin className="mr-1 inline h-3 w-3" />Pinned</Badge>}
                    <Badge variant={item.published ? 'success' : 'secondary'}>{item.published ? 'Published' : 'Draft'}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.body.slice(0, 120)}{item.body.length > 120 ? '…' : ''}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    By {item.author_name} · {new Date(item.created_at).toLocaleDateString()}
                    {item.expires_at && ` · Expires ${new Date(item.expires_at).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handlePatch(item.id, { is_pinned: !item.is_pinned })} aria-label={item.is_pinned ? 'Unpin' : 'Pin'}>
                    <Pin className={`h-4 w-4 ${item.is_pinned ? 'text-indigo-500' : ''}`} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handlePatch(item.id, { published: !item.published })} aria-label={item.published ? 'Unpublish' : 'Publish'}>
                    {item.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEditingId(item.id); setEditForm({ title: item.title, body: item.body }); setEditError('') }} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} aria-label="Delete">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  )
}
