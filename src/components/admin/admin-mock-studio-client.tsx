'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertCircle, Plus, Zap, Upload, Eye, EyeOff } from 'lucide-react'
import { apiRequest, jsonBody } from '@/lib/client/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { AdminMockTest, AdminMockTestListResponse, CreateMockTestBody, MarkingConfig } from '@/types/admin-mock-studio'
import type { QuizQuestion } from '@/lib/server/ai-generator'

const STATUS_VARIANT: Record<AdminMockTest['status'], 'default' | 'success' | 'secondary'> = {
  draft: 'secondary',
  published: 'success',
  archived: 'default',
}

function emptyForm(): CreateMockTestBody {
  return { title: '', paper: 'CS', duration_minutes: 180, mode: 'practice', marking_config_id: '' }
}

export function AdminMockStudioClient() {
  const [tests, setTests] = useState<AdminMockTest[]>([])
  const [configs, setConfigs] = useState<MarkingConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<CreateMockTestBody>(emptyForm())
  const [createLoading, setCreateLoading] = useState(false)

  // AI generation
  const [genTopic, setGenTopic] = useState('')
  const [genSubjectName, setGenSubjectName] = useState('')
  const [genSubjectId, setGenSubjectId] = useState('')
  const [genCount, setGenCount] = useState(10)
  const [genLoading, setGenLoading] = useState(false)
  const [genStep, setGenStep] = useState('')
  const [genError, setGenError] = useState('')
  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestion[] | null>(null)
  const [genProvider, setGenProvider] = useState('')
  const [genModel, setGenModel] = useState('')

  // Approve & attach
  const [attachTestId, setAttachTestId] = useState('')
  const [attachLoading, setAttachLoading] = useState(false)

  // Bulk JSON upload
  const [bulkJson, setBulkJson] = useState('')
  const [bulkPreview, setBulkPreview] = useState('')
  const [bulkParsed, setBulkParsed] = useState<QuizQuestion[] | null>(null)
  const [bulkAttachId, setBulkAttachId] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiRequest<AdminMockTestListResponse>('/api/v1/admin/mock-tests')
      setTests(res.items)
      setConfigs(res.marking_configs)
      if (res.marking_configs.length > 0 && !createForm.marking_config_id) {
        setCreateForm(f => ({ ...f, marking_config_id: res.marking_configs[0].id }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load mock tests')
    } finally {
      setLoading(false)
    }
  }, [createForm.marking_config_id])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    if (!createForm.marking_config_id) { setError('Select a marking config first'); return }
    setCreateLoading(true)
    try {
      await apiRequest('/api/v1/admin/mock-tests', { method: 'POST', body: jsonBody(createForm) })
      setSuccess('Mock test created')
      setShowCreate(false)
      setCreateForm(emptyForm())
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create mock test')
    } finally {
      setCreateLoading(false)
    }
  }

  async function handleTogglePublish(t: AdminMockTest) {
    try {
      if (t.status === 'published') {
        // Unpublish: make unavailable first, then set back to draft
        await apiRequest(`/api/v1/admin/mock-tests/${t.id}`, { method: 'PATCH', body: jsonBody({ is_available: false }) })
        await apiRequest(`/api/v1/admin/mock-tests/${t.id}`, { method: 'PATCH', body: jsonBody({ status: 'draft' }) })
      } else {
        // Publish: set status first so the server guard passes, then make available
        await apiRequest(`/api/v1/admin/mock-tests/${t.id}`, { method: 'PATCH', body: jsonBody({ status: 'published' }) })
        await apiRequest(`/api/v1/admin/mock-tests/${t.id}`, { method: 'PATCH', body: jsonBody({ is_available: true }) })
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update mock test')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this draft mock test?')) return
    try {
      await apiRequest(`/api/v1/admin/mock-tests/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete')
    }
  }

  async function handleGenerate() {
    if (!genTopic || !genSubjectName) { setGenError('Topic and subject name are required'); return }
    setGenLoading(true)
    setGenError('')
    setGeneratedQuestions(null)
    setGenStep('Calling AI providers…')
    try {
      const res = await apiRequest<{ items: QuizQuestion[]; provider: string; model: string; draft: true }>(
        '/api/v1/admin/mock-tests/generate',
        { method: 'POST', body: jsonBody({ topic: genTopic, subjectName: genSubjectName, subject_id: genSubjectId || genSubjectName, count: genCount }) }
      )
      setGeneratedQuestions(res.items)
      setGenProvider(res.provider)
      setGenModel(res.model)
      setGenStep('')
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed')
      setGenStep('')
    } finally {
      setGenLoading(false)
    }
  }

  async function handleApproveAndSave(questions: QuizQuestion[], targetTestId: string) {
    if (!targetTestId) { setError('Select a mock test to attach to'); return }
    setAttachLoading(true)
    try {
      // 1. Bulk insert as questions — response now includes inserted IDs directly
      const questionsPayload = questions.map(q => ({
        type: 'MCQ' as const,
        category: 'ai-generated' as const,
        section: 'CS' as const,
        prompt: q.question,
        options: [
          { key: 'A' as const, value: q.options.A },
          { key: 'B' as const, value: q.options.B },
          { key: 'C' as const, value: q.options.C },
          { key: 'D' as const, value: q.options.D },
        ],
        marks: 1 as const,
        explanation: q.explanation,
        subject_id: q.subject_id,
        correct_answer: q.correct_answer,
      }))
      const bulk = await apiRequest<{ inserted: number; ids: string[]; errors: { index: number; message: string }[] }>(
        '/api/v1/admin/questions/bulk',
        { method: 'POST', body: jsonBody({ questions: questionsPayload }) }
      )
      if (bulk.inserted === 0 || bulk.ids.length === 0) throw new Error('No questions were saved')
      // 2. Attach directly using the IDs returned from the bulk endpoint (no re-fetch needed)
      await apiRequest(`/api/v1/admin/mock-tests/${targetTestId}/questions`, {
        method: 'POST',
        body: jsonBody({ question_ids: bulk.ids }),
      })
      setSuccess(`${bulk.inserted} questions saved and attached to mock test`)
      setGeneratedQuestions(null)
      setAttachTestId('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save questions')
    } finally {
      setAttachLoading(false)
    }
  }

  function parseBulkJson() {
    try {
      const arr = JSON.parse(bulkJson)
      if (!Array.isArray(arr)) { setBulkPreview('Error: Expected a JSON array'); return }
      setBulkParsed(arr as QuizQuestion[])
      setBulkPreview(`Parsed ${arr.length} questions. First: "${String(arr[0]?.question ?? '').slice(0, 60)}…"`)
    } catch (e) {
      setBulkPreview(`Parse error: ${e instanceof Error ? e.message : 'Invalid JSON'}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mock Studio</h1>
          <p className="mt-1 text-muted-foreground">Create, generate, and publish mock exams.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(v => !v)}>
          <Plus className="h-4 w-4" /> New Mock Test
        </Button>
      </div>

      {error && <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}
      {success && <div role="status" className="rounded-md border border-green-400/40 p-3 text-sm text-green-700">{success}</div>}

      {/* Create form */}
      {showCreate && (
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Create Mock Test</h2>
          {configs.length === 0 && <div role="alert" className="text-sm text-amber-600">No marking configurations found — add one before creating a mock test.</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium">Title</label>
              <Input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. GATE CS Mock Test 1" />
            </div>
            <div>
              <label className="text-xs font-medium">Paper</label>
              <Select value={createForm.paper} onChange={e => setCreateForm(f => ({ ...f, paper: e.target.value as 'CS' | 'DA' }))}>
                <option value="CS">CS</option>
                <option value="DA">DA</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Duration (minutes)</label>
              <Input type="number" value={createForm.duration_minutes} onChange={e => setCreateForm(f => ({ ...f, duration_minutes: parseInt(e.target.value, 10) || 180 }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Mode</label>
              <Select value={createForm.mode ?? 'practice'} onChange={e => setCreateForm(f => ({ ...f, mode: e.target.value }))}>
                <option value="practice">Practice</option>
                <option value="exam">Exam</option>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium">Marking Configuration</label>
              <Select value={createForm.marking_config_id} onChange={e => setCreateForm(f => ({ ...f, marking_config_id: e.target.value }))}>
                <option value="">Select…</option>
                {configs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" isLoading={createLoading} onClick={handleCreate}>Create</Button>
          </div>
        </Card>
      )}

      {/* Mock test list */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-semibold">Mock Tests ({tests.length})</h2>
        </div>
        {loading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
        {!loading && tests.length === 0 && <div className="p-4 text-sm text-muted-foreground">No mock tests yet.</div>}
        {!loading && tests.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {tests.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{t.paper}</Badge>
                    <Badge variant={STATUS_VARIANT[t.status]}>{t.status}</Badge>
                    <Badge variant="outline">{t.duration_minutes}min</Badge>
                    {t.total_questions !== null && <Badge variant="outline">{t.total_questions}Q</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleTogglePublish(t)} aria-label={t.status === 'published' ? 'Unpublish' : 'Publish'}>
                    {t.status === 'published' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  {t.status === 'draft' && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)} aria-label="Delete">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* AI Generate */}
      <Card className="p-5 space-y-4">
        <h2 className="flex items-center gap-2 font-semibold"><Zap className="h-4 w-4 text-amber-500" /> Generate with AI</h2>
        <p className="text-xs text-muted-foreground">Free-tier limits: Groq (~6k tokens/min), OpenRouter (20 req/day). Large counts (65Q) may hit rate limits. Reduce count if generation fails.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium">Topic</label>
            <Input value={genTopic} onChange={e => setGenTopic(e.target.value)} placeholder="e.g. Dijkstra's Algorithm" />
          </div>
          <div>
            <label className="text-xs font-medium">Subject Name</label>
            <Input value={genSubjectName} onChange={e => setGenSubjectName(e.target.value)} placeholder="e.g. Algorithms" />
          </div>
          <div>
            <label className="text-xs font-medium">Subject ID (optional)</label>
            <Input value={genSubjectId} onChange={e => setGenSubjectId(e.target.value)} placeholder="e.g. cs-algorithms" />
          </div>
          <div>
            <label className="text-xs font-medium">Count (5–65)</label>
            <Input type="number" min={5} max={65} value={genCount} onChange={e => setGenCount(parseInt(e.target.value, 10) || 10)} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button isLoading={genLoading} onClick={handleGenerate} disabled={!genTopic || !genSubjectName}>
            <Zap className="h-4 w-4" /> Generate
          </Button>
          {genStep && <span className="text-sm text-muted-foreground animate-pulse">{genStep}</span>}
        </div>
        {genError && (
          <div role="alert" className="rounded-md border border-destructive/40 p-3 text-xs text-destructive whitespace-pre-wrap">
            <AlertCircle className="mr-2 inline h-4 w-4" />{genError}
          </div>
        )}
        {generatedQuestions && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-green-700">{generatedQuestions.length} questions generated via {genProvider} ({genModel}) — review before saving</p>
            <div className="space-y-2 max-h-64 overflow-y-auto rounded border border-slate-200 dark:border-slate-700 p-3">
              {generatedQuestions.slice(0, 5).map((q, i) => (
                <div key={q.id} className="text-xs">
                  <p className="font-medium">{i + 1}. {q.question.slice(0, 100)}…</p>
                  <p className="text-muted-foreground">Correct: {q.correct_answer}</p>
                </div>
              ))}
              {generatedQuestions.length > 5 && <p className="text-xs text-muted-foreground">… and {generatedQuestions.length - 5} more</p>}
            </div>
            <div className="flex items-center gap-3">
              <Select value={attachTestId} onChange={e => setAttachTestId(e.target.value)} className="w-64">
                <option value="">Select mock test to attach to…</option>
                {tests.filter(t => t.status === 'draft').map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </Select>
              <Button size="sm" isLoading={attachLoading} onClick={() => handleApproveAndSave(generatedQuestions, attachTestId)} disabled={!attachTestId}>
                Approve &amp; Save Draft
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Bulk JSON upload */}
      <Card className="p-5 space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><Upload className="h-4 w-4" /> Upload JSON Questions</h2>
        <textarea
          className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-xs font-mono h-32 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder={'[{"question":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"correct_answer":"A","explanation":"..."}]'}
          value={bulkJson}
          onChange={e => setBulkJson(e.target.value)}
        />
        {bulkPreview && <p className="text-sm text-muted-foreground">{bulkPreview}</p>}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={parseBulkJson}>Parse &amp; Preview</Button>
          {bulkParsed && (
            <>
              <Select value={bulkAttachId} onChange={e => setBulkAttachId(e.target.value)} className="w-64">
                <option value="">Select mock test…</option>
                {tests.filter(t => t.status === 'draft').map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </Select>
              <Button size="sm" isLoading={bulkLoading} disabled={!bulkAttachId} onClick={async () => {
                if (!bulkParsed || !bulkAttachId) return
                setBulkLoading(true)
                try {
                  await handleApproveAndSave(bulkParsed, bulkAttachId)
                  setBulkJson('')
                  setBulkParsed(null)
                  setBulkPreview('')
                } finally {
                  setBulkLoading(false)
                }
              }}>Save as Draft</Button>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
