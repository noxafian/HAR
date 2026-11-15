'use client'

import { useEffect, useState } from 'react'
import { RotateCw, CheckCircle2, AlertCircle, Plus, ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { CS_SUBJECTS, DA_SUBJECTS } from '@/lib/constants'
import { cn } from '@/lib/cn'
import { apiRequest, jsonBody } from '@/lib/client/api'

interface Flashcard {
  id: string; subject_name: string; topic_name: string; front: string; back: string
  is_remembered?: boolean; is_difficult?: boolean; review_count?: number; is_ai_generated?: boolean
}

export default function FlashcardsPage() {
  const [cards, setCards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newSubject, setNewSubject] = useState('Operating Systems')
  const [newTopic, setNewTopic] = useState('')
  const [generateCount, setGenerateCount] = useState(5)
  const [generating, setGenerating] = useState(false)
  const [generateSuccess, setGenerateSuccess] = useState('')
  const [manualMode, setManualMode] = useState(false)
  const [manualFront, setManualFront] = useState('')
  const [manualBack, setManualBack] = useState('')

  async function loadCards() {
    setLoading(true); setError('')
    try {
      const result = await apiRequest<{ items: Flashcard[] }>('/api/v1/revision/flashcards?limit=100')
      setCards(result.items)
      setCurrentIndex(i => Math.min(i, Math.max(result.items.length - 1, 0)))
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load flashcards') }
    finally { setLoading(false) }
  }

  useEffect(() => { void loadCards() }, [])

  const currentCard = cards[currentIndex]
  const rememberedCount = cards.filter(c => c.is_remembered).length
  const difficultCount = cards.filter(c => c.is_difficult).length

  async function markStatus(status: 'remembered' | 'difficult') {
    if (!currentCard || saving) return
    setSaving(true); setError('')
    try {
      await apiRequest(`/api/v1/revision/flashcards/${currentCard.id}`, {
        method: 'PATCH', body: jsonBody({ reviewResult: status === 'remembered' ? 'good' : 'again' }),
      })
      setCards(prev => prev.map(c => c.id === currentCard.id ? { ...c, is_remembered: status === 'remembered', is_difficult: status === 'difficult', review_count: (c.review_count ?? 0) + 1 } : c))
      setFlipped(false)
      if (currentIndex < cards.length - 1) setCurrentIndex(i => i + 1)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save review') }
    finally { setSaving(false) }
  }

  async function handleGenerateCards() {
    if (!newTopic.trim() || generating) return
    setGenerating(true); setError(''); setGenerateSuccess('')
    try {
      // 1. Call the AI generate endpoint
      const result = await apiRequest<{ items: Array<{ front: string; back: string }> }>('/api/v1/study/generate', {
        method: 'POST',
        body: jsonBody({
          type: 'flashcards',
          subject_id: [...CS_SUBJECTS, ...DA_SUBJECTS].find(s => s.name === newSubject)?.id ?? newSubject.toLowerCase().replace(/\s+/g, '-'),
          subject_name: newSubject,
          topic: newTopic.trim(),
          count: generateCount
        })
      })
      // 2. Save each generated card
      let saved = 0
      for (const card of result.items) {
        try {
          const savedCard = await apiRequest<Flashcard>('/api/v1/revision/flashcards', {
            method: 'POST',
            body: jsonBody({ subject: newSubject, topic: newTopic.trim(), front: card.front, back: card.back, isAiGenerated: true })
          })
          setCards(prev => [savedCard, ...prev])
          saved++
        } catch { /* skip individual failures */ }
      }
      setCurrentIndex(0); setFlipped(false)
      setGenerateSuccess(`${saved} flashcard${saved !== 1 ? 's' : ''} generated and saved!`)
      setNewTopic(''); setGenerateCount(5)
      setTimeout(() => { setCreateOpen(false); setGenerateSuccess('') }, 1500)
    } catch (e) { setError(e instanceof Error ? e.message : 'AI generation failed') }
    finally { setGenerating(false) }
  }

  async function handleCreateManual() {
    if (!newTopic.trim() || !manualFront.trim() || !manualBack.trim() || saving) return
    setSaving(true); setError('')
    try {
      const card = await apiRequest<Flashcard>('/api/v1/revision/flashcards', {
        method: 'POST', body: jsonBody({ subject: newSubject, topic: newTopic.trim(), front: manualFront.trim(), back: manualBack.trim() })
      })
      setCards(prev => [card, ...prev]); setCurrentIndex(0); setFlipped(false)
      setManualFront(''); setManualBack(''); setManualMode(false); setCreateOpen(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create flashcard') }
    finally { setSaving(false) }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Flashcards</h1><p className="mt-1 text-sm text-slate-500">Active recall cards saved to your personal revision deck.</p></div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Create Flashcard</Button>
      </div>
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
      <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-900">
        <div><span className="text-xs text-slate-500">Total Cards</span><p className="text-lg font-bold text-slate-800 dark:text-slate-200">{cards.length}</p></div>
        <div><span className="text-xs text-slate-500">Marked Remembered</span><p className="text-lg font-bold text-emerald-600">{rememberedCount}</p></div>
        <div><span className="text-xs text-slate-500">Needs Practice</span><p className="text-lg font-bold text-amber-600">{difficultCount}</p></div>
      </div>
      {loading ? <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading your flashcards…</div> : cards.length > 0 && currentCard ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1"><div className="flex items-center gap-2"><Badge variant="outline">{currentCard.subject_name}</Badge><span className="text-xs text-slate-500">{currentCard.topic_name}</span>{currentCard.is_ai_generated && <Badge variant="secondary" className="text-xs">AI Generated</Badge>}</div><span className="text-xs font-semibold text-slate-400">Card {currentIndex + 1} of {cards.length}</span></div>
          <div className="group relative h-64 w-full cursor-pointer select-none" style={{ perspective: '1000px' }} onClick={() => setFlipped(f => !f)}>
            <div className={cn('relative h-full w-full rounded-2xl shadow-sm transition-transform duration-500', flipped && 'rotate-y-180')} style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
              <div className="absolute inset-0 flex flex-col justify-between rounded-2xl border-2 border-indigo-100 bg-white p-6 dark:border-indigo-900 dark:bg-slate-900" style={{ backfaceVisibility: 'hidden' }}><div className="flex items-center justify-between"><span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Question / Prompt</span><RotateCw className="h-4 w-4 text-slate-400" /></div><div className="flex flex-1 items-center justify-center text-center"><p className="text-lg font-medium leading-relaxed text-slate-900 dark:text-slate-100">{currentCard.front}</p></div><p className="text-center text-xs text-slate-400">Click card to reveal answer</p></div>
              <div className="absolute inset-0 flex flex-col justify-between rounded-2xl border-2 border-indigo-200 bg-indigo-50/70 p-6 dark:border-indigo-800 dark:bg-indigo-950/60" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}><div className="flex items-center justify-between"><span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Answer / Explanation</span><RotateCw className="h-4 w-4 text-slate-400" /></div><div className="flex flex-1 items-center justify-center text-center"><p className="whitespace-pre-line text-sm leading-relaxed text-slate-800 dark:text-slate-200">{currentCard.back}</p></div><p className="text-center text-xs text-slate-400">Click card to flip back</p></div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => { setFlipped(false); setCurrentIndex(i => Math.max(0, i - 1)) }} disabled={currentIndex === 0}><ChevronLeft className="mr-1 h-4 w-4"/>Previous</Button><Button variant="outline" size="sm" onClick={() => { setFlipped(false); setCurrentIndex(i => Math.min(cards.length - 1, i + 1)) }} disabled={currentIndex === cards.length - 1}>Next<ChevronRight className="ml-1 h-4 w-4"/></Button></div>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={saving} className="text-amber-600 hover:text-amber-700" onClick={() => void markStatus('difficult')}><AlertCircle className="mr-1.5 h-4 w-4"/>Needs Practice</Button><Button size="sm" disabled={saving} className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => void markStatus('remembered')}><CheckCircle2 className="mr-1.5 h-4 w-4"/>Remembered</Button></div>
          </div>
        </div>
      ) : <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700"><h2 className="font-semibold text-slate-800 dark:text-slate-200">Your flashcard deck is empty</h2><p className="mt-2 text-sm text-slate-500">Create your first card. It will be saved to your account and available on your next visit.</p><Button className="mt-4" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4"/>Create Flashcard</Button></div>}

      <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) { setManualMode(false); setGenerateSuccess('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Flashcards with AI</DialogTitle>
            <DialogDescription>AI will generate GATE-focused flashcards for the topic you specify.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {generateSuccess && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{generateSuccess}</div>}
            {!manualMode ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="fc-subject">Subject</Label>
                    <Select id="fc-subject" value={newSubject} onChange={e => setNewSubject(e.target.value)}>
                      {[...CS_SUBJECTS, ...DA_SUBJECTS].map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="fc-topic" required>Topic</Label>
                    <Input id="fc-topic" value={newTopic} onChange={e => setNewTopic(e.target.value)} placeholder="e.g. Memory Management"/>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fc-count">Number of cards (1–10)</Label>
                  <Select id="fc-count" value={generateCount} onChange={e => setGenerateCount(Number(e.target.value))}>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} cards</option>)}
                  </Select>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row">
                  <DialogClose><Button variant="outline">Cancel</Button></DialogClose>
                  <Button disabled={generating || !newTopic.trim()} onClick={() => void handleGenerateCards()}>
                    {generating ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin"/>Generating…</> : <><Sparkles className="mr-1.5 h-4 w-4"/>Generate with AI</>}
                  </Button>
                </DialogFooter>
                <div className="text-center">
                  <button type="button" onClick={() => setManualMode(true)} className="text-xs text-slate-400 underline hover:text-slate-600">Create manually instead</button>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="fc-m-subject">Subject</Label>
                    <Select id="fc-m-subject" value={newSubject} onChange={e => setNewSubject(e.target.value)}>
                      {[...CS_SUBJECTS, ...DA_SUBJECTS].map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="fc-m-topic" required>Topic</Label>
                    <Input id="fc-m-topic" value={newTopic} onChange={e => setNewTopic(e.target.value)} placeholder="e.g. Memory Management"/>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fc-m-front" required>Front (Question)</Label>
                  <Textarea id="fc-m-front" value={manualFront} onChange={e => setManualFront(e.target.value)} placeholder="Enter your question or prompt"/>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fc-m-back" required>Back (Answer)</Label>
                  <Textarea id="fc-m-back" value={manualBack} onChange={e => setManualBack(e.target.value)} placeholder="Enter the answer or explanation"/>
                </div>
                <DialogFooter>
                  <button type="button" onClick={() => setManualMode(false)} className="text-xs text-slate-400 underline hover:text-slate-600 mr-auto">Use AI generation</button>
                  <DialogClose><Button variant="outline">Cancel</Button></DialogClose>
                  <Button disabled={saving || !newTopic.trim() || !manualFront.trim() || !manualBack.trim()} onClick={() => void handleCreateManual()}>{saving ? 'Saving…' : 'Save Card'}</Button>
                </DialogFooter>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
