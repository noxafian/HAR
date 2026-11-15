'use client'

import { useEffect, useState } from 'react'
import { Link2, CheckCircle2, AlertCircle, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { AI_PROVIDER_META } from '@/types/ai-provider'
import type { AIProvider } from '@/types/ai-provider'
import { apiRequest, jsonBody } from '@/lib/client/api'

interface Connection { id: string; provider: AIProvider; modelId?: string; status: 'active' | 'disabled' | 'rotated'; createdAt: string; lastUsedAt?: string; usageCount: number }

export default function AIConnectPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [keys, setKeys] = useState<Record<AIProvider, string>>({ openai: '', gemini: '', groq: '', openrouter: '', anthropic: '' })
  const [models, setModels] = useState<Record<AIProvider, string>>({ openai: '', gemini: '', groq: '', openrouter: '', anthropic: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true); setError('')
    try { setConnections(await apiRequest<Connection[]>('/api/v1/ai/connections')) }
    catch (e) { setError(e instanceof Error ? e.message : 'Connections could not be loaded') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  async function connect(provider: AIProvider) {
    if (!keys[provider].trim()) return
    setBusy(provider); setError(''); setNotice('')
    try {
      const connection = await apiRequest<Connection>('/api/v1/ai/connections', { method: 'POST', body: jsonBody({ provider, apiKey: keys[provider].trim(), ...(models[provider] ? { modelId: models[provider] } : {}) }) })
      setKeys(current => ({ ...current, [provider]: '' }))
      try {
        await apiRequest(`/api/v1/ai/connections/${connection.id}/verify`, { method: 'POST', body: jsonBody({}) })
        setNotice(`${provider} connection saved and verified.`)
      } catch (e) { setNotice(`${provider} key is encrypted and saved, but provider verification failed: ${e instanceof Error ? e.message : 'verification error'}`) }
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Provider connection failed') }
    finally { setBusy(null) }
  }

  async function verify(connection: Connection) {
    setBusy(connection.id); setError(''); setNotice('')
    try { await apiRequest(`/api/v1/ai/connections/${connection.id}/verify`, { method: 'POST', body: jsonBody({}) }); setNotice(`${connection.provider} connection verified.`) }
    catch (e) { setError(e instanceof Error ? e.message : 'Provider verification failed') }
    finally { setBusy(null) }
  }

  async function disconnect(connection: Connection) {
    setBusy(connection.id); setError(''); setNotice('')
    try { await apiRequest(`/api/v1/ai/connections/${connection.id}`, { method: 'DELETE' }); setNotice(`${connection.provider} connection removed.`); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Provider disconnect failed') }
    finally { setBusy(null) }
  }

  return <div className="mx-auto max-w-3xl space-y-6">
    <div><h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">AI Provider Connections</h1><p className="mt-1 text-sm text-slate-500">Connect your own provider key. It is encrypted server-side and never returned to the browser.</p></div>
    <Alert variant="warning" title="Credential security">Keys are sent only to the server, encrypted using AES-256-GCM, and stored in the private database schema. Never paste a key into a discussion or support message.</Alert>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
    {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</div>}
    {loading ? <div className="flex justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading saved provider connections…</div> : <div className="grid gap-4">
      {AI_PROVIDER_META.map(provider => {
        const connection = connections.find(item => item.provider === provider.provider && item.status === 'active')
        const busyThis = busy === provider.provider || (connection && busy === connection.id)
        return <Card key={provider.provider}><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2">{provider.label}<Badge variant={connection ? 'success' : 'outline'}>{connection ? 'Connected' : 'Not configured'}</Badge></CardTitle><CardDescription className="mt-1">{provider.description}</CardDescription></div>{connection && <div className="flex items-center gap-1.5"><Button variant="outline" size="sm" onClick={() => void verify(connection)} disabled={Boolean(busy)}><RefreshCw className="mr-1 h-3.5 w-3.5"/>Verify</Button><Button variant="ghost" size="icon" onClick={() => void disconnect(connection)} disabled={Boolean(busy)} aria-label={`Disconnect ${provider.label}`}><Trash2 className="h-4 w-4"/></Button></div>}</div></CardHeader><CardContent>
          {connection ? <div className="space-y-1 text-xs text-slate-500"><p>Model: <span className="font-medium text-slate-700 dark:text-slate-300">{connection.modelId ?? 'Provider default'}</span></p><p>Used {connection.usageCount} times{connection.lastUsedAt ? ` · Last used ${new Date(connection.lastUsedAt).toLocaleString()}` : ''}</p><p>Connected {new Date(connection.createdAt).toLocaleDateString()}</p></div> : <div className="space-y-3"><div className="flex flex-col gap-1.5"><Label htmlFor={`${provider.provider}-key`}>API key</Label><Input id={`${provider.provider}-key`} type="password" autoComplete="off" value={keys[provider.provider]} onChange={e => setKeys(current => ({ ...current, [provider.provider]: e.target.value }))} placeholder="Paste your provider API key" maxLength={512}/><p className="text-xs text-slate-500">Get your key from <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline dark:text-indigo-400">the provider's official documentation</a>.</p></div><div className="flex flex-col gap-1.5"><Label htmlFor={`${provider.provider}-model`}>Model (optional)</Label><select id={`${provider.provider}-model`} value={models[provider.provider]} onChange={e => setModels(current => ({ ...current, [provider.provider]: e.target.value }))} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">Provider default</option>{provider.models.map(model => <option key={model} value={model}>{model}</option>)}</select></div><Button className="w-full" onClick={() => void connect(provider.provider)} disabled={!keys[provider.provider].trim() || Boolean(busy)}>{busyThis ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin"/>Connecting…</> : <><Link2 className="mr-1.5 h-4 w-4"/>Connect {provider.label}</>}</Button></div>}
        </CardContent></Card>
      })}
    </div>}
    <p className="text-xs text-slate-500">Disconnecting deletes the stored credential. Provider usage charges, rate limits and billing remain subject to your provider account.</p>
  </div>
}
