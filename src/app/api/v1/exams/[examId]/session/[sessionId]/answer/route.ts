/** POST /api/v1/exams/[examId]/session/[sessionId]/answer — server-validated autosave. */
import { NextRequest, NextResponse } from 'next/server'
import { requireApprovedMember } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { SaveAnswerSchema } from '@/schemas/exam.schema'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
type Ctx = { params: Promise<{ examId: string; sessionId: string }> }
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await requireApprovedMember().catch((error: unknown) => {
    const status = (error as { status?: number }).status ?? 401
    return status === 403 ? 'membership-denied' : null
  })
  if (user === null) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (user === 'membership-denied') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required'), { status: 403 })
  const { examId, sessionId } = await params
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = SaveAnswerSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })

  const supabase = await createSupabaseClient()
  const { data: session, error: sessionError } = await supabase.from('exam_sessions')
    .select('mock_test_id').eq('id', sessionId).eq('user_id', user.id).maybeSingle()
  if (sessionError || !session || session.mock_test_id !== examId) {
    return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Exam session not found'), { status: 404 })
  }
  const { data, error } = await supabase.rpc('save_exam_answer', {
    p_session_id: sessionId,
    p_question_id: parsed.data.questionId,
    p_answer: parsed.data.answer,
    p_marked_review: parsed.data.markedForReview,
  })
  if (error) {
    const status = error.code === 'P0002' ? 404 : error.code === '42501' ? 403 : error.code === '22023' ? 400 : 500
    return NextResponse.json(createErrorResponse(status === 404 ? ErrorCodes.RESOURCE_NOT_FOUND.id : status === 403 ? ErrorCodes.INSUFFICIENT_PERMISSIONS.id : status === 400 ? ErrorCodes.VALIDATION_FAILED.id : ErrorCodes.INTERNAL_SERVER_ERROR.id, status === 500 ? 'Answer could not be saved' : error.message), { status })
  }
  const saved = data as { saved?: boolean; status?: string; questionId?: string }
  if (!saved.saved) {
    const expired = saved.status === 'expired' || saved.status === 'session_expired'
    return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_CONFLICT.id, expired ? 'Exam time has expired' : 'Exam session is no longer active'), { status: 409 })
  }
  return NextResponse.json(createApiResponse({ saved: true, questionId: parsed.data.questionId, status: saved.status }, 'Answer saved'))
}
