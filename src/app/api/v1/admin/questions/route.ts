import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import type { AdminQuestion, AdminQuestionListResponse } from '@/types/admin-questions'

const CreateQuestionSchema = z.object({
  type: z.enum(['MCQ', 'MSQ', 'NAT']),
  category: z.enum(['official-pyq', 'member-contributed', 'ai-generated', 'unverified']),
  section: z.enum(['CS', 'DA', 'GA']),
  year: z.number().int().min(2000).max(2040).optional(),
  subject_id: z.string().uuid().optional(),
  topic_id: z.string().uuid().optional(),
  prompt: z.string().min(1).max(20000).trim(),
  options: z.array(z.object({ key: z.enum(['A', 'B', 'C', 'D']), value: z.string().min(1) })).min(2).max(4).optional(),
  marks: z.union([z.literal(1), z.literal(2)]),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  source_ref: z.string().max(500).optional(),
  explanation: z.string().max(5000).optional(),
  correct_answer: z.string().max(10).optional(),
})

async function authGuard() {
  const user = await getAuthenticatedUser()
  if (!user) return { error: NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 }), user: null }
  if (!user.isActive || user.role !== 'owner') {
    return { error: NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 }), user: null }
  }
  return { error: null, user }
}

export async function GET(req: NextRequest) {
  const { error, user } = await authGuard()
  if (error || !user) return error!
  const db = await createSupabaseClient()
  const { searchParams } = new URL(req.url)
  const subject_id = searchParams.get('subject_id')
  const section = searchParams.get('section')
  const year = searchParams.get('year')
  const is_verified = searchParams.get('is_verified')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  let query = db.from('questions').select('id,type,category,section,year,subject_id,topic_id,prompt,options,marks,difficulty,source_ref,is_verified,explanation,created_at,updated_at', { count: 'exact' }).eq('is_deleted', false)
  if (subject_id) query = query.eq('subject_id', subject_id)
  if (section) query = query.eq('section', section)
  if (year) query = query.eq('year', parseInt(year, 10))
  if (is_verified !== null) query = query.eq('is_verified', is_verified === 'true')

  const { data, error: dbError, count } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
  if (dbError) {
    console.error('[admin.questions.get]', dbError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve questions'), { status: 500 })
  }

  const items: AdminQuestion[] = (data ?? []).map(row => ({
    id: row.id as string,
    type: row.type as AdminQuestion['type'],
    category: row.category as AdminQuestion['category'],
    section: row.section as AdminQuestion['section'],
    year: row.year as number | null,
    subject_id: row.subject_id as string | null,
    topic_id: row.topic_id as string | null,
    prompt: row.prompt as string,
    options: row.options as AdminQuestion['options'],
    marks: row.marks as 1 | 2,
    difficulty: row.difficulty as AdminQuestion['difficulty'],
    source_ref: row.source_ref as string | null,
    is_verified: row.is_verified as boolean,
    explanation: row.explanation as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }))

  const response: AdminQuestionListResponse = { items, total: count ?? 0, limit, offset }
  return NextResponse.json(createApiResponse(response, 'Questions retrieved'))
}

export async function POST(req: NextRequest) {
  const { error, user } = await authGuard()
  if (error || !user) return error!
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = CreateQuestionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, parsed.error.issues[0]?.message ?? 'Validation failed'), { status: 400 })
  }
  const { correct_answer, ...questionFields } = parsed.data
  const db = await createSupabaseClient()
  const { data, error: dbError } = await db.from('questions').insert({
    ...questionFields,
    is_verified: false,
    is_deleted: false,
    submitted_by: user.id,
  }).select('id,type,category,section,year,subject_id,topic_id,prompt,options,marks,difficulty,source_ref,is_verified,explanation,created_at,updated_at').single()
  if (dbError) {
    console.error('[admin.questions.post]', dbError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not create question'), { status: 500 })
  }
  if (correct_answer && data) {
    const { error: akErr } = await db.from('question_answer_keys').insert({ question_id: data.id, correct_answer })
    if (akErr) console.error('[admin.questions.post] answer key insert failed', akErr.message)
  }
  return NextResponse.json(createApiResponse(data, 'Question created'), { status: 201 })
}
