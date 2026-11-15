'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertCircle, Pencil, Trash2, CheckCircle, XCircle, Plus, Upload } from 'lucide-react'
import { apiRequest, jsonBody } from '@/lib/client/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { AdminQuestion, AdminQuestionListResponse, CreateQuestionBody, QuestionDifficulty, QuestionSection, QuestionType, ContentCategory } from '@/types/admin-questions'

const SECTION_OPTIONS: QuestionSection[] = ['CS', 'DA', 'GA']
const DIFFICULTY_OPTIONS: QuestionDifficulty[] = ['easy', 'medium', 'hard']
const TYPE_OPTIONS: QuestionType[] = ['MCQ', 'MSQ', 'NAT']
const CATEGORY_OPTIONS: ContentCategory[] = ['official-pyq', 'member-contributed', 'ai-generated', 'unverified']

const DIFFICULTY_VARIANT: Record<QuestionDifficulty, 'success' | 'warning' | 'destructive'> = {
  easy: 'success',
  medium: 'warning',
  hard: 'destructive',
}

const SECTION_JSON_EXAMPLE = `[
  {
    "type": "MCQ",
    "category": "official-pyq",
    "section": "CS",
    "year": 2023,
    "subject_id": "cs-algorithms",
    "prompt": "What is the time complexity of binary search?",
    "options": [
      {"key":"A","value":"O(n)"},
      {"key":"B","value":"O(log n)"},
      {"key":"C","value":"O(n log n)"},
      {"key":"D","value":"O(1)"}
    ],
    "marks": 1,
    "difficulty": "easy",
    "correct_answer": "B",
    "explanation": "Binary search divides the search space in half at each step."
  }
]`

const PYQ_JSON_EXAMPLE = `[
  {
    "question": "What is the time complexity of binary search?",
    "options": ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
    "correct": "B",
    "explanation": "Binary search halves the search space each step.",
    "subject": "Algorithms",
    "topic": "Searching",
    "year": 2023,
    "paper": "CS"
  }
]`

function emptyForm(): CreateQuestionBody {
  return { type: 'MCQ', category: 'official-pyq', section: 'CS', prompt: '', marks: 1 }
}

export function AdminQuestionsClient() {
  const [questions, setQuestions] = useState<AdminQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Filters
  const [filterSection, setFilterSection] = useState('')
  const [filterVerified, setFilterVerified] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  // Add/Edit dialog
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CreateQuestionBody>(emptyForm())
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // Bulk upload
  const [showBulk, setShowBulk] = useState(false)
  const [bulkJson, setBulkJson] = useState('')
  const [bulkPreview, setBulkPreview] = useState<string>('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkFileName, setBulkFileName] = useState('')
  const [showPyqFormat, setShowPyqFormat] = useState(false)

  // PYQ Quick Upload
  const [pyqYear, setPyqYear] = useState<number>(new Date().getFullYear())
  const [pyqPaper, setPyqPaper] = useState<'CS' | 'DA' | 'GA'>('CS')
  const [pyqFile, setPyqFile] = useState<File | null>(null)
  const [pyqFileName, setPyqFileName] = useState('')
  const [pyqLoading, setPyqLoading] = useState(false)
  const [pyqPreview, setPyqPreview] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filterSection) params.set('section', filterSection)
      if (filterVerified) params.set('is_verified', filterVerified)
      const res = await apiRequest<AdminQuestionListResponse>(`/api/v1/admin/questions?${params}`)
      setQuestions(res.items)
      setTotal(res.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load questions')
    } finally {
      setLoading(false)
    }
  }, [filterSection, filterVerified])

  useEffect(() => { load() }, [load])

  const filtered = filterSearch
    ? questions.filter(q => q.prompt.toLowerCase().includes(filterSearch.toLowerCase()))
    : questions

  const stats = {
    total,
    verified: questions.filter(q => q.is_verified).length,
    unverified: questions.filter(q => !q.is_verified).length,
    CS: questions.filter(q => q.section === 'CS').length,
    DA: questions.filter(q => q.section === 'DA').length,
    GA: questions.filter(q => q.section === 'GA').length,
  }

  async function handleSave() {
    setFormError('')
    setFormLoading(true)
    try {
      if (editingId) {
        await apiRequest(`/api/v1/admin/questions/${editingId}`, { method: 'PATCH', body: jsonBody(formData) })
        setSuccess('Question updated')
      } else {
        await apiRequest('/api/v1/admin/questions', { method: 'POST', body: jsonBody(formData) })
        setSuccess('Question created')
      }
      setShowDialog(false)
      setFormData(emptyForm())
      setEditingId(null)
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save question')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleToggleVerify(q: AdminQuestion) {
    try {
      await apiRequest(`/api/v1/admin/questions/${q.id}`, { method: 'PATCH', body: jsonBody({ is_verified: !q.is_verified }) })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update question')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this question? This is a soft-delete.')) return
    try {
      await apiRequest(`/api/v1/admin/questions/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete question')
    }
  }

  function openEdit(q: AdminQuestion) {
    setFormData({
      type: q.type,
      category: q.category,
      section: q.section,
      year: q.year ?? undefined,
      subject_id: q.subject_id ?? undefined,
      prompt: q.prompt,
      options: q.options ?? undefined,
      marks: q.marks,
      difficulty: q.difficulty ?? undefined,
      source_ref: q.source_ref ?? undefined,
      explanation: q.explanation ?? undefined,
    })
    setEditingId(q.id)
    setFormError('')
    setShowDialog(true)
  }

  function parseBulk() {
    if (!bulkJson.trim()) { setBulkPreview('Paste JSON or upload a .json file first'); return }
    try {
      const arr = JSON.parse(bulkJson)
      if (!Array.isArray(arr)) { setBulkPreview('Error: Expected a JSON array at the top level'); return }
      const first = arr[0] as Record<string, unknown>
      const format = (first && typeof first.question === 'string' && !first.prompt)
        ? 'PYQ format (will be auto-transformed)'
        : 'Standard format'
      setBulkPreview(`✓ Parsed ${arr.length} question(s) [${format}] — ready to submit`)
    } catch (e) {
      setBulkPreview(`Parse error: ${e instanceof Error ? e.message : 'Invalid JSON'}`)
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.json')) { setBulkPreview('Error: Please select a .json file'); return }
    setBulkFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setBulkJson(text)
      // Auto-parse on load
      try {
        const arr = JSON.parse(text)
        if (!Array.isArray(arr)) { setBulkPreview('Error: Expected a JSON array at the top level'); return }
        setBulkPreview(`✓ Loaded "${file.name}" — ${arr.length} question(s) ready to submit`)
      } catch (err) {
        setBulkPreview(`Parse error in file: ${err instanceof Error ? err.message : 'Invalid JSON'}`)
      }
    }
    reader.readAsText(file)
    // Reset input so same file can be re-uploaded
    e.target.value = ''
  }

  async function submitBulk() {
    setBulkLoading(true)
    try {
      const arr = JSON.parse(bulkJson) as unknown[]
      // Auto-transform simpler PYQ format if detected
      const transformed = arr.map((item: unknown) => {
        const q = item as Record<string, unknown>
        // If it uses 'question' key (user's PYQ format), transform to API format
        if (typeof q.question === 'string' && !q.prompt) {
          const optArr = Array.isArray(q.options) ? q.options as string[] : []
          return {
            type: 'MCQ' as const,
            category: 'official-pyq' as const,
            section: (q.paper as string) || 'CS',
            year: typeof q.year === 'number' ? q.year : undefined,
            subject_id: typeof q.subject === 'string' ? q.subject.toLowerCase().replace(/\s+/g, '-') : undefined,
            prompt: q.question as string,
            options: optArr.map((val, idx) => ({ key: ['A','B','C','D'][idx] as 'A'|'B'|'C'|'D', value: val })),
            marks: 1 as const,
            correct_answer: typeof q.correct === 'string' ? q.correct : undefined,
            explanation: typeof q.explanation === 'string' ? q.explanation : undefined,
          }
        }
        return q
      })
      const res = await apiRequest<{ inserted: number; errors: { index: number; message: string }[] }>(
        '/api/v1/admin/questions/bulk',
        { method: 'POST', body: jsonBody({ questions: transformed }) }
      )
      setSuccess(`Bulk upload: ${res.inserted} inserted, ${res.errors.length} failed`)
      setBulkJson('')
      setBulkPreview('')
      setShowBulk(false)
      await load()
    } catch (e) {
      setBulkPreview(`Submit error: ${e instanceof Error ? e.message : 'Failed'}`)
    } finally {
      setBulkLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Question Bank</h1>
          <p className="mt-1 text-muted-foreground">Manage PYQ questions and bulk imports.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setShowBulk(v => !v) }}>
            <Upload className="h-4 w-4" /> Upload JSON
          </Button>
          <Button size="sm" onClick={() => { setFormData(emptyForm()); setEditingId(null); setFormError(''); setShowDialog(true) }}>
            <Plus className="h-4 w-4" /> Add Question
          </Button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}
      {success && <div role="status" className="rounded-md border border-green-400/40 p-3 text-sm text-green-700">{success}</div>}

      {/* PYQ Quick Upload */}
      <Card className="p-5">
        <h2 className="font-semibold text-base mb-3">PYQ Quick Upload</h2>
        <p className="text-sm text-muted-foreground mb-4">Upload a JSON file of PYQ questions. Year, paper, and category=official-pyq are set automatically for all questions.</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">Year</label>
            <Select value={String(pyqYear)} onChange={e => setPyqYear(Number(e.target.value))} className="w-28">
              {Array.from({ length: 15 }, (_, i) => 2024 - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Paper</label>
            <Select value={pyqPaper} onChange={e => setPyqPaper(e.target.value as 'CS' | 'DA' | 'GA')} className="w-24">
              <option value="CS">CS</option>
              <option value="DA">DA</option>
              <option value="GA">GA</option>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">JSON File</label>
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800">
              <Upload className="h-4 w-4" />
              {pyqFileName || 'Choose .json file'}
              <input type="file" accept=".json,application/json" className="sr-only" onChange={e => {
                const f = e.target.files?.[0]
                if (!f) return
                setPyqFile(f)
                setPyqFileName(f.name)
                e.target.value = ''
              }} />
            </label>
          </div>
          <Button
            size="sm"
            disabled={!pyqFile || pyqLoading}
            isLoading={pyqLoading}
            onClick={async () => {
              if (!pyqFile) return
              setPyqLoading(true)
              setPyqPreview('')
              try {
                const text = await pyqFile.text()
                const arr = JSON.parse(text) as unknown[]
                if (!Array.isArray(arr)) { setPyqPreview('Error: Expected a JSON array'); return }
                const transformed = arr.map((item: unknown) => {
                  const q = item as Record<string, unknown>
                  const optArr = Array.isArray(q.options) ? q.options as string[] : []
                  if (typeof q.question === 'string' && !q.prompt) {
                    return {
                      type: 'MCQ' as const,
                      category: 'official-pyq' as const,
                      section: pyqPaper,
                      year: pyqYear,
                      subject_id: typeof q.subject === 'string' ? q.subject.toLowerCase().replace(/\s+/g, '-') : undefined,
                      prompt: q.question as string,
                      options: optArr.map((val, idx) => ({ key: ['A','B','C','D'][idx] as 'A'|'B'|'C'|'D', value: val })),
                      marks: 1 as const,
                      correct_answer: typeof q.correct === 'string' ? q.correct : undefined,
                      explanation: typeof q.explanation === 'string' ? q.explanation : undefined,
                    }
                  }
                  return { ...q, year: pyqYear, section: pyqPaper, category: 'official-pyq' as const }
                })
                const res = await apiRequest<{ inserted: number; errors: { index: number; message: string }[] }>(
                  '/api/v1/admin/questions/bulk',
                  { method: 'POST', body: jsonBody({ questions: transformed }) }
                )
                setPyqPreview(`✓ Uploaded: ${res.inserted} inserted, ${res.errors.length} failed`)
                setSuccess(`PYQ ${pyqYear} ${pyqPaper}: ${res.inserted} questions uploaded`)
                setPyqFile(null); setPyqFileName('')
                await load()
              } catch (e) {
                setPyqPreview(`Error: ${e instanceof Error ? e.message : 'Upload failed'}`)
              } finally {
                setPyqLoading(false)
              }
            }}
          >
            Upload PYQs
          </Button>
        </div>
        {pyqPreview && (
          <p className={`mt-3 text-sm ${pyqPreview.startsWith('✓') ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}>{pyqPreview}</p>
        )}
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {[
          ['Total', total],
          ['Verified', stats.verified],
          ['Unverified', stats.unverified],
          ['CS', stats.CS],
          ['DA', stats.DA],
          ['GA', stats.GA],
        ].map(([label, val]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{val}</p>
          </Card>
        ))}
      </div>

      {/* Year Summary */}
      {questions.length > 0 && (() => {
        const byYear = questions.reduce<Record<string, number>>((acc, q) => {
          const key = q.year ? String(q.year) : 'No year'
          acc[key] = (acc[key] ?? 0) + 1
          return acc
        }, {})
        const yearEntries = Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0]))
        return (
          <Card className="p-4">
            <h2 className="text-sm font-semibold mb-3">Questions by Year</h2>
            <div className="flex flex-wrap gap-2">
              {yearEntries.map(([year, cnt]) => (
                <Badge key={year} variant="outline">{year}: {cnt}</Badge>
              ))}
            </div>
          </Card>
        )
      })()}

      {/* Bulk Upload Panel */}
      {showBulk && (
        <Card className="p-5 space-y-3">
          <h2 className="font-semibold">Bulk JSON Upload</h2>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-muted-foreground">Format example:</span>
            <button type="button" onClick={() => setShowPyqFormat(f => !f)} className="text-xs underline text-indigo-600">
              {showPyqFormat ? 'Show standard format' : 'Show PYQ format'}
            </button>
          </div>
          <pre className="rounded bg-slate-100 dark:bg-slate-800 p-3 text-xs overflow-x-auto">{showPyqFormat ? PYQ_JSON_EXAMPLE : SECTION_JSON_EXAMPLE}</pre>

          {/* File picker */}
          <div className="flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <Upload className="h-4 w-4" />
              {bulkFileName ? bulkFileName : 'Choose .json file'}
              <input
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={handleFileUpload}
              />
            </label>
            <span className="text-xs text-muted-foreground">or paste below</span>
          </div>

          <textarea
            className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-xs font-mono h-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Paste your JSON array here..."
            value={bulkJson}
            onChange={e => { setBulkJson(e.target.value); setBulkFileName('') }}
          />
          {bulkPreview && (
            <p className={`text-sm ${bulkPreview.startsWith('✓') ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}>
              {bulkPreview}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={parseBulk}>Parse &amp; Preview</Button>
            <Button size="sm" isLoading={bulkLoading} onClick={submitBulk} disabled={!bulkJson.trim() || bulkLoading}>
              Submit Bulk Upload
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowBulk(false); setBulkJson(''); setBulkPreview(''); setBulkFileName('') }}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4 flex flex-wrap gap-3">
        <Input
          placeholder="Search prompt…"
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          className="w-48"
        />
        <Select value={filterSection} onChange={e => setFilterSection(e.target.value)} className="w-36">
          <option value="">All sections</option>
          {SECTION_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={filterVerified} onChange={e => setFilterVerified(e.target.value)} className="w-40">
          <option value="">All statuses</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </Select>
        <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
      </Card>

      {/* Question list */}
      <Card className="overflow-hidden">
        {loading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
        {!loading && filtered.length === 0 && <div className="p-6 text-sm text-muted-foreground">No questions found.</div>}
        {!loading && filtered.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map(q => (
              <div key={q.id} className="flex items-start gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{q.prompt.slice(0, 80)}{q.prompt.length > 80 ? '…' : ''}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{q.section}</Badge>
                    <Badge variant="outline">{q.category}</Badge>
                    {q.year && <Badge variant="outline">{q.year}</Badge>}
                    {q.difficulty && <Badge variant={DIFFICULTY_VARIANT[q.difficulty]}>{q.difficulty}</Badge>}
                    <Badge variant={q.is_verified ? 'success' : 'warning'}>{q.is_verified ? 'Verified' : 'Unverified'}</Badge>
                    <Badge variant="secondary">{q.marks}m</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleToggleVerify(q)} aria-label={q.is_verified ? 'Unverify' : 'Verify'}>
                    {q.is_verified ? <XCircle className="h-4 w-4 text-amber-500" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(q)} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)} aria-label="Delete">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Question' : 'Add Question'}</DialogTitle>
          </DialogHeader>
          {formError && <div role="alert" className="rounded border border-destructive/40 p-2 text-xs text-destructive mb-2">{formError}</div>}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Type</label>
                <Select value={formData.type} onChange={e => setFormData(d => ({ ...d, type: e.target.value as QuestionType }))}>
                  {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Section</label>
                <Select value={formData.section} onChange={e => setFormData(d => ({ ...d, section: e.target.value as QuestionSection }))}>
                  {SECTION_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Category</label>
                <Select value={formData.category} onChange={e => setFormData(d => ({ ...d, category: e.target.value as ContentCategory }))}>
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Marks</label>
                <Select value={String(formData.marks)} onChange={e => setFormData(d => ({ ...d, marks: parseInt(e.target.value, 10) as 1 | 2 }))}>
                  <option value="1">1</option>
                  <option value="2">2</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Year</label>
                <Input type="number" value={formData.year ?? ''} onChange={e => setFormData(d => ({ ...d, year: e.target.value ? parseInt(e.target.value, 10) : undefined }))} placeholder="e.g. 2023" />
              </div>
              <div>
                <label className="text-xs font-medium">Difficulty</label>
                <Select value={formData.difficulty ?? ''} onChange={e => setFormData(d => ({ ...d, difficulty: (e.target.value || undefined) as QuestionDifficulty | undefined }))}>
                  <option value="">None</option>
                  {DIFFICULTY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Prompt *</label>
              <textarea
                className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-sm h-24 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.prompt}
                onChange={e => setFormData(d => ({ ...d, prompt: e.target.value }))}
                placeholder="Question text..."
              />
            </div>
            {(formData.type === 'MCQ' || formData.type === 'MSQ') && (
              <div className="space-y-2">
                <label className="text-xs font-medium">Options</label>
                {(['A', 'B', 'C', 'D'] as const).map(key => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs font-bold w-4">{key}</span>
                    <Input
                      value={formData.options?.find(o => o.key === key)?.value ?? ''}
                      onChange={e => {
                        const value = e.target.value
                        setFormData(d => {
                          const opts = [...(d.options ?? [])]
                          const idx = opts.findIndex(o => o.key === key)
                          if (idx >= 0) opts[idx] = { key, value }
                          else opts.push({ key, value })
                          return { ...d, options: opts }
                        })
                      }}
                      placeholder={`Option ${key}`}
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium">Correct Answer</label>
                  <Input value={formData.correct_answer ?? ''} onChange={e => setFormData(d => ({ ...d, correct_answer: e.target.value }))} placeholder="A, B, C, or D" className="w-32" />
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-medium">Explanation</label>
              <textarea
                className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-sm h-16 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.explanation ?? ''}
                onChange={e => setFormData(d => ({ ...d, explanation: e.target.value }))}
                placeholder="Optional explanation..."
              />
            </div>
            <div>
              <label className="text-xs font-medium">Subject ID</label>
              <Input value={formData.subject_id ?? ''} onChange={e => setFormData(d => ({ ...d, subject_id: e.target.value || undefined }))} placeholder="e.g. cs-algorithms" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button isLoading={formLoading} onClick={handleSave}>
              {editingId ? 'Save Changes' : 'Create Question'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
