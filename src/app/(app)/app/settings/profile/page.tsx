'use client'

import { useEffect, useState } from 'react'
import { User, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { apiRequest, jsonBody } from '@/lib/client/api'

interface Profile { id: string; email: string; displayName: string; avatarUrl: string | null; examPapers: ('CS' | 'DA')[] }

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [papers, setPapers] = useState<('CS' | 'DA')[]>(['CS'])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    apiRequest<Profile>('/api/v1/users/profile').then(result => {
      if (!active) return
      setProfile(result); setDisplayName(result.displayName); setPapers(result.examPapers)
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Profile could not be loaded') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  function togglePaper(paper: 'CS' | 'DA', checked: boolean) {
    setPapers(current => checked ? [...current, paper] : current.filter(value => value !== paper))
  }
  async function save() {
    setSaving(true); setError(''); setNotice('')
    try {
      const updated = await apiRequest<Profile>('/api/v1/users/profile', { method: 'PATCH', body: jsonBody({ displayName: displayName.trim(), examPapers: papers }) })
      setProfile(updated); setDisplayName(updated.displayName); setPapers(updated.examPapers); setNotice('Profile changes saved.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Profile changes could not be saved') }
    finally { setSaving(false) }
  }

  return <div className="mx-auto max-w-2xl space-y-6">
    <div><h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Profile Settings</h1><p className="mt-1 text-sm text-slate-500">Manage your account information and examination preferences.</p></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
    {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</div>}
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><User className="h-4 w-4"/>Personal Information</CardTitle></CardHeader><CardContent className="space-y-4">
      {loading ? <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading profile…</div> : <>
        <div className="flex items-center gap-4"><Avatar size="lg"><AvatarFallback>{(displayName.trim()[0] || 'U').toUpperCase()}</AvatarFallback></Avatar><div><p className="text-sm font-medium">{displayName || 'StudyHub member'}</p><p className="text-xs text-slate-500">Profile avatar upload is not enabled yet.</p></div></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="display-name" required>Display name</Label><Input id="display-name" placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={64}/></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="email">Email address</Label><Input id="email" type="email" value={profile?.email ?? ''} disabled/><p className="text-xs text-slate-500">Email is managed by your authentication account.</p></div>
        <div className="flex flex-col gap-2"><Label>Examination papers</Label><p className="text-xs text-slate-500">Select at least one paper.</p><div className="flex flex-wrap gap-4"><Checkbox id="profile-cs" label="CS — Computer Science" checked={papers.includes('CS')} onChange={e => togglePaper('CS', e.target.checked)}/><Checkbox id="profile-da" label="DA — Data Science & AI" checked={papers.includes('DA')} onChange={e => togglePaper('DA', e.target.checked)}/></div></div>
        <Button className="w-full" onClick={() => void save()} disabled={saving || !displayName.trim() || displayName.trim().length < 2 || papers.length === 0}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Saving…</> : 'Save Changes'}</Button>
      </>}
    </CardContent></Card>
  </div>
}
