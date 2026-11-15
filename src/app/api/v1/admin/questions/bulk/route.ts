import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

const QuestionItemSchema = z.object({
  type: z.enum(['MCQ', 'MSQ', 'NAT']),
  category: z.enum(['official-pyq', 'member-contributed', 'ai-generated', 'unverified']),
  section: z.enum(['CS', 'DA', 'GA']),
  year: z.number().int().min(2000).max(2040).optional(),
  // Accept any non-empty string (slug or UUID) — AI generator may return slugs like 'cs-algorithms'
  subject_id: z.string().min(1).max(100).optional(),
  topic_id: z.string().uuid().optional(),
  prompt: z.string().min(1).max(20000).trim(),
  options: z.array(z.object({ key: z.enum(['A', 'B', 'C', 'D']), value: z.string().min(1) })).min(2).max(4).optional(),
  marks: z.union([z.literal(1), z.literal(2)]),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  source_ref: z.string().max(500).optional(),
  explanation: z.string().max(5000).optional(),
  correct_answer: z.string().max(10).optional(),
})

const BulkSchema = z.object({ questions: z.array(QuestionItemSchema).min(1).max(500) })

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive || user.role !== 'owner') {
    return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  }
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = BulkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, parsed.error.issues[0]?.message ?? 'Validation failed'), { status: 400 })
  }
  const db = await createSupabaseClient()
  let inserted = 0
  const insertedIds: string[] = []
  const errors: { index: number; message: string }[] = []

  for (let i = 0; i < parsed.data.questions.length; i++) {
    const { correct_answer, ...questionFields } = parsed.data.questions[i]
    const { data, error: dbError } = await db.from('questions').insert({
      ...questionFields,
      is_verified: false,
      is_deleted: false,
      submitted_by: user.id,
    }).select('id').single()
    if (dbError) {
      errors.push({ index: i, message: dbError.message })
      continue
    }
    if (correct_answer && data) {
      const { error: akErr } = await db.from('question_answer_keys').insert({ question_id: data.id, correct_answer })
      if (akErr) console.error(`[admin.questions.bulk] answer key insert failed for index ${i}`, akErr.message)
    }
    insertedIds.push(data.id as string)
    inserted++
  }

  return NextResponse.json(createApiResponse({ inserted, ids: insertedIds, errors }, `${inserted} question(s) inserted`), { status: 201 })
}
