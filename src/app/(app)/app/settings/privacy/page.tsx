'use client'

import { useEffect, useState } from 'react'
import { Shield, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { apiRequest, jsonBody } from '@/lib/client/api'

interface PrivacySettings { profilePublic: boolean; showStudyStats: boolean; allowMessages: boolean; showAnalytics: boolean }
const defaults: PrivacySettings = { profilePublic: false, showStudyStats: false, allowMessages: true, showAnalytics: false }

export default function PrivacySettingsPage() {
  const [settings, setSettings] = useState<PrivacySettings>(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    apiRequest<PrivacySettings>('/api/v1/users/privacy-settings').then(result => { if (active) setSettings(result) })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Privacy settings could not be loaded') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  function update<K extends keyof PrivacySettings>(key: K, value: PrivacySettings[K]) { setSettings(current => ({ ...current, [key]: value })) }
  async function save() {
    setSaving(true); setError(''); setNotice('')
    try { const result = await apiRequest<PrivacySettings>('/api/v1/users/privacy-settings', { method: 'PATCH', body: jsonBody(settings) }); setSettings(result); setNotice('Privacy settings saved.') }
    catch (e) { setError(e instanceof Error ? e.message : 'Privacy settings could not be saved') }
    finally { setSaving(false) }
  }
  return <div className="mx-auto max-w-2xl space-y-6">
    <div><h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Privacy Settings</h1><p className="mt-1 text-sm text-slate-500">Control which profile details and study indicators other approved members may see.</p></div>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
    {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</div>}
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4"/>Visibility Preferences</CardTitle></CardHeader><CardContent className="space-y-6">
      {loading ? <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading privacy settings…</div> : <>
        <div className="flex flex-col gap-2"><Label>Profile visibility</Label><RadioGroup value={settings.profilePublic ? 'public' : 'members-only'} onValueChange={value => update('profilePublic', value === 'public')}><RadioGroupItem value="public" id="visibility-public" label="Visible to approved StudyHub members"/><RadioGroupItem value="members-only" id="visibility-members" label="Private (only visible to you)"/></RadioGroup></div>
        <div className="flex flex-col gap-3"><Label>Profile information</Label><Checkbox id="share-study-stats" label="Show study statistics on my public profile" checked={settings.showStudyStats} onChange={e => update('showStudyStats', e.target.checked)}/><Checkbox id="allow-messages" label="Allow other members to message me" checked={settings.allowMessages} onChange={e => update('allowMessages', e.target.checked)}/><Checkbox id="show-analytics" label="Allow my analytics summary to be shared where supported" checked={settings.showAnalytics} onChange={e => update('showAnalytics', e.target.checked)}/></div>
        <p className="text-xs text-slate-500">Email, authentication details and private profile preferences are never included in the public profile view. Analytics sharing is a preference flag; no public analytics endpoint is currently exposed.</p>
        <Button className="w-full" onClick={() => void save()} disabled={saving}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Saving…</> : 'Save Preferences'}</Button>
      </>}
    </CardContent></Card>
  </div>
}
