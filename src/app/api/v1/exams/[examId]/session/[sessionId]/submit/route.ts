/** POST /api/v1/exams/[examId]/session/[sessionId]/submit — score saved answers in PostgreSQL. */
import { NextResponse } from 'next/server'
import { requireApprovedMember } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { logAuditEvent } from '@/security/audit'
type Ctx = { params: Promise<{ examId: string; sessionId: string }> }
export async function POST(_req: Request, { params }: Ctx) {
  const user = await requireApprovedMember().catch((error: unknown) => {
    const status = (error as { status?: number }).status ?? 401
    return status === 403 ? 'membership-denied' : null
  })
  if (user === null) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (user === 'membership-denied') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required'), { status: 403 })
  const { examId, sessionId } = await params
  const supabase = await createSupabaseClient()
  const { data: session, error: sessionError } = await supabase.from('exam_sessions')
    .select('mock_test_id').eq('id', sessionId).eq('user_id', user.id).maybeSingle()
  if (sessionError || !session || session.mock_test_id !== examId) {
    return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Exam session not found'), { status: 404 })
  }
  const { data, error } = await supabase.rpc('score_exam', { p_session_id: sessionId })
  if (error) {
    const status = error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 409
    return NextResponse.json(createErrorResponse(status === 403 ? ErrorCodes.INSUFFICIENT_PERMISSIONS.id : status === 404 ? ErrorCodes.RESOURCE_NOT_FOUND.id : ErrorCodes.RESOURCE_CONFLICT.id, error.message), { status })
  }
  await logAuditEvent('exam.submitted', user.id, 'exam_session', sessionId, { status: 'success', metadata: { examId } })
  return NextResponse.json(createApiResponse(data, 'Exam scored successfully'))
}
