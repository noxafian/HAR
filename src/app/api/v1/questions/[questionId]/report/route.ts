import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { ReportQuestionSchema } from '@/schemas/question.schema'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REASONS = { 'wrong-answer': 'wrong answer', 'wrong-explanation': 'wrong explanation', outdated: 'outdated', duplicate: 'duplicate', other: 'other' } as const

export async function POST(req: NextRequest, { params }: { params: Promise<{ questionId: string }> }) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive) return NextResponse.json(createErrorResponse(ErrorCodes.MEMBERSHIP_PENDING.id, ErrorCodes.MEMBERSHIP_PENDING.message), { status: 403 })
  const { questionId } = await params
  if (!UUID.test(questionId)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid question ID'), { status: 400 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = ReportQuestionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from('question_reports').insert({ question_id: questionId, reported_by: user.id, reason: REASONS[parsed.data.reason], details: parsed.data.details ?? null }).select('id,question_id,reason,details,status,created_at').single()
  if (error) {
    if (error.code === '23505') return NextResponse.json(createErrorResponse(ErrorCodes.DUPLICATE_RESOURCE.id, 'You have already reported this question'), { status: 409 })
    if (error.code === '23503') return NextResponse.json(createErrorResponse(ErrorCodes.QUESTION_NOT_FOUND.id, 'Question not found'), { status: 404 })
    console.error('[questions.report]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not submit report'), { status: 500 })
  }
  return NextResponse.json(createApiResponse(data, 'Report submitted'), { status: 201 })
}
