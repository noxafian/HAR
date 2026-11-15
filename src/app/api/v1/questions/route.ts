import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { resolveSubjectTopic } from '@/lib/server/study-lookup'
import { SubmitQuestionSchema, QuestionListQuerySchema } from '@/schemas/question.schema'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive) return NextResponse.json(createErrorResponse(ErrorCodes.MEMBERSHIP_PENDING.id, ErrorCodes.MEMBERSHIP_PENDING.message), { status: 403 })
  const parsed = QuestionListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Invalid query'), { status: 400 })
  const filters = parsed.data
  const supabase = await createSupabaseClient()
  let query = supabase.from('questions').select('id,type,category,section,year,subject_id,topic_id,prompt,options,marks,difficulty,source_ref,is_verified,submitted_by,created_at,updated_at', { count: 'exact' }).eq('is_deleted', false).eq('is_verified', true).order('year', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
  if (filters.paper) query = query.eq('section', filters.paper)
  if (filters.type) query = query.eq('type', filters.type)
  if (filters.category) query = query.eq('category', filters.category)
  if (filters.year) query = query.eq('year', filters.year)
  if (filters.difficulty) query = query.eq('difficulty', filters.difficulty)
  if (filters.search) query = query.ilike('prompt', `%${filters.search.replace(/[%_]/g, '\\$&')}%`)
  if (filters.subject) {
    const resolved = await resolveSubjectTopic(supabase, filters.subject)
    if (resolved.error) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, resolved.error), { status: 400 })
  if (resolved.topicLabel && !resolved.topicId) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Choose an existing syllabus topic for this shared item'), { status: 400 })
    query = query.eq('subject_id', resolved.subjectId)
  }
  if (filters.topic) {
    const resolved = await resolveSubjectTopic(supabase, filters.subject, filters.topic)
    if (resolved.error) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, resolved.error), { status: 400 })
  if (resolved.topicLabel && !resolved.topicId) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Choose an existing syllabus topic for this shared item'), { status: 400 })
    query = query.eq('topic_id', resolved.topicId)
  }
  const { data, error, count } = await query.range(filters.offset, filters.offset + filters.limit - 1)
  if (error) {
    console.error('[questions.get]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve questions'), { status: 500 })
  }
  const subjectIds = [...new Set((data ?? []).map(row => row.subject_id).filter((id): id is string => Boolean(id)))]
  const topicIds = [...new Set((data ?? []).map(row => row.topic_id).filter((id): id is string => Boolean(id)))]
  const [subjects, topics] = await Promise.all([
    subjectIds.length ? supabase.from('subjects').select('id,name').in('id', subjectIds) : Promise.resolve({ data: [], error: null }),
    topicIds.length ? supabase.from('topics').select('id,name').in('id', topicIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (subjects.error || topics.error) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not resolve question subjects'), { status: 500 })
  const subjectNames = new Map((subjects.data ?? []).map(row => [row.id, row.name]))
  const topicNames = new Map((topics.data ?? []).map(row => [row.id, row.name]))
  const items = (data ?? []).map(row => ({ ...row, options: Array.isArray(row.options) ? row.options.map((option: unknown) => typeof option === 'object' && option !== null && 'text' in option ? String((option as { text: unknown }).text) : String(option)) : null, source_ref: row.source_ref ?? null, paper: row.section, subject_name: row.subject_id ? subjectNames.get(row.subject_id) ?? 'Uncategorised' : 'General Aptitude', topic_name: row.topic_id ? topicNames.get(row.topic_id) ?? 'General' : 'General' }))
  return NextResponse.json(createApiResponse({ items, total: count ?? 0, page: Math.floor(filters.offset / filters.limit) + 1, limit: filters.limit, hasMore: filters.offset + filters.limit < (count ?? 0) }, 'Questions retrieved'))
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive) return NextResponse.json(createErrorResponse(ErrorCodes.MEMBERSHIP_PENDING.id, ErrorCodes.MEMBERSHIP_PENDING.message), { status: 403 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = SubmitQuestionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })
  if (parsed.data.type === 'MCQ' && (!parsed.data.options || parsed.data.options.length < 2)) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'MCQ requires options'), { status: 400 })
  if (parsed.data.type === 'MSQ' && (!parsed.data.options || parsed.data.options.length < 2)) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'MSQ requires options'), { status: 400 })
  if (parsed.data.correctAnswer !== undefined && parsed.data.type === 'MCQ' && typeof parsed.data.correctAnswer !== 'string') return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'MCQ answer must be one option'), { status: 400 })
  if (parsed.data.correctAnswer !== undefined && parsed.data.type === 'MSQ' && (!Array.isArray(parsed.data.correctAnswer) || !parsed.data.correctAnswer.length)) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'MSQ answer must be a non-empty option list'), { status: 400 })
  if (parsed.data.correctAnswer !== undefined && parsed.data.type === 'NAT' && typeof parsed.data.correctAnswer !== 'number') return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'NAT answer must be numeric'), { status: 400 })
  const supabase = await createSupabaseClient()
  const resolved = await resolveSubjectTopic(supabase, parsed.data.subject, parsed.data.topic)
  if (resolved.error) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, resolved.error), { status: 400 })
  if (resolved.topicLabel && !resolved.topicId) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Choose an existing syllabus topic for this shared item'), { status: 400 })
  const section = parsed.data.paper ?? (user.examPapers[0] ?? 'CS')
  const optionRows = (parsed.data.options ?? []).map((text, index) => ({ id: String.fromCharCode(65 + index), text }))
  const normalizeOptionId = (value: string) => {
    const byId = optionRows.find(option => option.id.toUpperCase() === value.trim().toUpperCase())
    if (byId) return byId.id
    return optionRows.find(option => option.text === value)?.id ?? null
  }
  let correctAnswer: string | string[] | number | null = null
  if (parsed.data.correctAnswer !== undefined) {
    if (parsed.data.type === 'MCQ') {
      correctAnswer = normalizeOptionId(parsed.data.correctAnswer as string)
      if (!correctAnswer) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'MCQ answer must match an option or option ID (A–F)'), { status: 400 })
    } else if (parsed.data.type === 'MSQ') {
      const normalized = (parsed.data.correctAnswer as string[]).map(normalizeOptionId)
      if (normalized.some(value => value === null) || new Set(normalized).size !== normalized.length) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'MSQ answers must be unique available options'), { status: 400 })
      correctAnswer = normalized as string[]
    } else {
      correctAnswer = parsed.data.correctAnswer as number
    }
  }
  const { data, error } = await supabase.rpc('submit_member_question', {
    p_question: {
      type: parsed.data.type, category: parsed.data.category, section,
      year: parsed.data.year ?? null, subject_id: resolved.subjectId, topic_id: resolved.topicId,
      prompt: parsed.data.prompt, options: parsed.data.type === 'NAT' ? null : optionRows,
      marks: parsed.data.marks ?? 1, difficulty: parsed.data.difficulty ?? null,
      source_ref: parsed.data.sourceRef ?? null, solution: parsed.data.explanation ?? null,
    },
    p_correct_answer: correctAnswer,
  })
  if (error) {
    if (error.code === '42501') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required'), { status: 403 })
    console.error('[questions.post]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not submit question'), { status: 500 })
  }
  return NextResponse.json(createApiResponse({ id: data, category: parsed.data.category, status: 'unverified' }, 'Question submitted for review'), { status: 201 })
}
