/** POST /api/v1/exams/[examId]/session/[sessionId]/submit — score saved answers in PostgreSQL. */
import { NextResponse } from 'next/server'
import { requireApprovedMember } from '@/lib/server/auth'
import { createSupabaseClient, createServiceRoleClient } from '@/lib/server/supabase'
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

  // Auto-log incorrect answers to the mistakes table (best-effort, never fails the response)
  try {
    const scoreData = data as Record<string, unknown> | null
    const questionResults = Array.isArray(scoreData?.questionResults) ? scoreData.questionResults as Array<Record<string, unknown>> : []
    if (questionResults.length > 0) {
      const db = createServiceRoleClient()
      for (const qr of questionResults) {
        if (qr.outcome !== 'incorrect') continue
        const questionId = qr.questionId as string
        const { data: question, error: qErr } = await db
          .from('questions')
          .select('id,prompt,explanation,subject_id,topic_id')
          .eq('id', questionId)
          .maybeSingle()
        if (qErr || !question) continue
        const studentAnswer = qr.studentAnswer != null ? String(qr.studentAnswer) : ''
        const correctAnswer = qr.correctAnswer != null ? String(qr.correctAnswer) : null
        await db.from('mistakes').insert({
          user_id: user.id,
          question_id: questionId,
          question_text: question.prompt,
          my_answer: studentAnswer,
          your_answer: studentAnswer,
          correct_answer: correctAnswer,
          explanation: question.explanation ?? null,
          subject_id: question.subject_id,
          topic_id: question.topic_id,
          source_type: 'mock_test',
          source_ref: sessionId,
          category: 'Conceptual',
          resolved: false,
        })
      }
    }
  } catch (mistakeErr) {
    console.error('[submit] mistake auto-log failed:', mistakeErr instanceof Error ? mistakeErr.message : mistakeErr)
  }

  await logAuditEvent('exam.submitted', user.id, 'exam_session', sessionId, { status: 'success', metadata: { examId } })
  return NextResponse.json(createApiResponse(data, 'Exam scored successfully'))
}
