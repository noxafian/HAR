'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Send, Bot, User, Loader2, Plus, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Alert } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { CS_SUBJECTS, DA_SUBJECTS, GA_SUBJECTS, ROUTE_PATHS } from '@/lib/constants'
import type { ExamPaper } from '@/types/exam'
import { apiRequest, jsonBody } from '@/lib/client/api'

type Provider = 'openai' | 'gemini' | 'groq' | 'openrouter' | 'anthropic'
interface Connection { id: string; provider: Provider; modelId?: string; status: 'active' | 'disabled' | 'rotated' }
interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; model?: string; createdAt: string }
interface ChatResponse { content: string; model: string; usage?: { totalTokens?: number } }

export default function AIAssistantPage() {
  const [selectedPaper, setSelectedPaper] = useState<ExamPaper>('CS')
  const [selectedSubject, setSelectedSubject] = useState<string>('cs-os')
  const [connectionId, setConnectionId] = useState('')
  const [connections, setConnections] = useState<Connection[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const subjects = selectedPaper === 'CS' ? CS_SUBJECTS : selectedPaper === 'DA' ? DA_SUBJECTS : GA_SUBJECTS
  const activeConnections = useMemo(() => connections.filter(connection => connection.status === 'active'), [connections])
  const selectedConnection = activeConnections.find(connection => connection.id === connectionId) ?? activeConnections[0]

  useEffect(() => {
    let active = true
    apiRequest<Connection[]>('/api/v1/ai/connections').then(result => {
      if (!active) return
      const usable = result.filter(item => item.status === 'active')
      setConnections(result); setConnectionId(usable[0]?.id ?? '')
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'AI provider connections could not be loaded') })
      .finally(() => { if (active) setLoadingConnections(false) })
    return () => { active = false }
  }, [])

  async function handleSend() {
    const content = inputMessage.trim()
    if (!content || !selectedConnection || sending) return
    setSending(true); setError(''); setInputMessage('')
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content, createdAt: new Date().toISOString() }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    const subjectName = subjects.find(item => item.id === selectedSubject)?.name ?? 'General Aptitude'
    const systemPrompt = [
      'You are Keryvion StudyHub, a careful GATE preparation tutor.',
      `The learner is studying GATE ${selectedPaper}, subject: ${subjectName}.`,
      'Explain concepts step by step, show derivations where useful, and distinguish verified facts from assumptions.',
      'Do not invent official GATE syllabus clauses, previous-year questions, citations, exam rules, or answer keys.',
      'No course documents or retrieval citations are attached to this request. If the answer depends on a specific source, say it is not source-verified.',
      'Use exam-focused examples and offer a short practice question when appropriate.',
    ].join(' ')
    try {
      const response = await apiRequest<ChatResponse>('/api/v1/ai/chat', {
        method: 'POST',
        body: jsonBody({
          connectionId: selectedConnection.id,
          messages: [{ role: 'system', content: systemPrompt }, ...nextMessages.map(message => ({ role: message.role, content: message.content }))],
          temperature: 0.4,
          maxTokens: 1800,
          stream: false,
        }),
      })
      setMessages(current => [...current, { id: crypto.randomUUID(), role: 'assistant', content: response.content, model: response.model, createdAt: new Date().toISOString() }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI request failed')
      // Keep the user's question visible so it can be retried without losing it.
    } finally { setSending(false) }
  }

  function resetConversation() { setMessages([]); setError('') }

  return <div className="flex h-[calc(100vh-4rem)] flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"><Sparkles className="h-5 w-5"/></div><div><h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">AI Study Assistant</h1><p className="text-xs text-slate-500">Live chat through your encrypted provider connection</p></div></div><div className="flex flex-wrap items-center gap-2"><Select aria-label="Exam paper" value={selectedPaper} onChange={e => { const paper = e.target.value as ExamPaper; setSelectedPaper(paper); setSelectedSubject(paper === 'CS' ? 'cs-os' : paper === 'DA' ? 'da-prob-stats' : 'ga-verbal') }} className="h-8 text-xs"><option value="CS">GATE CS</option><option value="DA">GATE DA</option><option value="GA">General Aptitude</option></Select><Select aria-label="Subject" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="h-8 max-w-48 text-xs">{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</Select><Select aria-label="AI connection" value={selectedConnection?.id ?? ''} onChange={e => setConnectionId(e.target.value)} className="h-8 max-w-52 text-xs" disabled={activeConnections.length === 0}>{activeConnections.map(connection => <option key={connection.id} value={connection.id}>{connection.provider} · {connection.modelId ?? 'default'}</option>)}</Select><Link href={ROUTE_PATHS.aiConnect}><Button variant="outline" size="sm" className="h-8 text-xs"><Settings2 className="mr-1 h-3.5 w-3.5"/>Connections</Button></Link></div></div>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-700"><div className="flex items-center gap-2 text-xs text-slate-500"><Badge variant={selectedConnection ? 'success' : 'warning'}>{selectedConnection ? 'Provider ready' : 'No provider connected'}</Badge><span>Conversation stays in this browser session and is not stored as chat history.</span></div><Button variant="ghost" size="sm" onClick={resetConversation} disabled={messages.length === 0 || sending}><Plus className="mr-1 h-3.5 w-3.5"/>New chat</Button></div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <Alert variant="default" title="Source-grounding limitation">The assistant uses your selected paper and subject as context, but document retrieval, PDF extraction and page citations are not implemented yet. It will not claim to have read your uploaded resources.</Alert>
        {loadingConnections ? <div className="flex justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Checking provider connections…</div> : activeConnections.length === 0 ? <div className="mx-auto max-w-lg py-12 text-center"><Bot className="mx-auto h-9 w-9 text-indigo-500"/><h2 className="mt-3 font-semibold">Connect an AI provider to start</h2><p className="mt-1 text-sm text-slate-500">Your API key will be encrypted and stored server-side. The key is never sent back to this page.</p><Link href={ROUTE_PATHS.aiConnect}><Button className="mt-4">Configure provider</Button></Link></div> : messages.length === 0 ? <div className="mx-auto max-w-lg py-12 text-center"><Bot className="mx-auto h-9 w-9 text-indigo-500"/><h2 className="mt-3 font-semibold">Ask a GATE preparation question</h2><p className="mt-1 text-sm text-slate-500">Selected context: GATE {selectedPaper} · {subjects.find(subject => subject.id === selectedSubject)?.name ?? 'General Aptitude'}</p></div> : messages.map(message => <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>{message.role === 'assistant' && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"><Bot className="h-4 w-4"/></div>}<div className={`max-w-3xl whitespace-pre-wrap rounded-xl p-4 text-sm leading-relaxed ${message.role === 'user' ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'}`}>{message.content}{message.model && <p className="mt-2 border-t border-current/10 pt-2 text-[10px] opacity-60">{message.model}</p>}</div>{message.role === 'user' && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"><User className="h-4 w-4"/></div>}</div>)}
        {sending && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Your provider is generating a response…</div>}
      </div>
      {error && <div role="alert" className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
      <div className="border-t border-slate-200 p-3 dark:border-slate-700"><div className="flex items-end gap-2"><Textarea rows={2} value={inputMessage} onChange={e => setInputMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }} placeholder={`Ask about ${subjects.find(subject => subject.id === selectedSubject)?.name ?? 'your GATE topic'}…`} disabled={!selectedConnection || sending} className="min-h-11 resize-y"/><Button onClick={() => void handleSend()} disabled={!inputMessage.trim() || !selectedConnection || sending} aria-label="Send message"><Send className="h-4 w-4"/></Button></div><p className="mt-1.5 text-right text-[10px] text-slate-500">Enter to send · Shift+Enter for a new line · Provider billing and rate limits apply</p></div>
    </div>
  </div>
}
