/** GET /api/v1/exams/[examId]/results/[attemptId] — own result only. */
import { NextRequest, NextResponse } from 'next/server'
import { requireApprovedMember } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
type Ctx = { params: Promise<{ examId: string; attemptId: string }> }
export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await requireApprovedMember().catch((error: unknown) => {
    const status = (error as { status?: number }).status ?? 401
    return status === 403 ? 'membership-denied' : null
  })
  if (user === null) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (user === 'membership-denied') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required'), { status: 403 })
  const { examId, attemptId } = await params
  const supabase = await createSupabaseClient()
  const { data: result, error } = await supabase.from('exam_results')
    .select('id,session_id,total_marks_raw,total_marks,max_possible_marks,correct_count,incorrect_count,unanswered_count,accuracy,duration_seconds,question_results,subject_breakdown,marking_config_snapshot,created_at')
    .eq('id', attemptId).eq('user_id', user.id).maybeSingle()
  if (error || !result) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Attempt not found'), { status: 404 })
  const { data: session, error: sessionError } = await supabase.from('exam_sessions')
    .select('mock_test_id,paper,started_at,submitted_at').eq('id', result.session_id).eq('user_id', user.id).maybeSingle()
  if (sessionError || !session || session.mock_test_id !== examId) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Attempt not found'), { status: 404 })
  return NextResponse.json(createApiResponse({
    id: result.id, sessionId: result.session_id, paper: session.paper,
    rawMarks: Number(result.total_marks_raw), totalMarks: Number(result.total_marks),
    maxPossibleMarks: Number(result.max_possible_marks), correct: result.correct_count,
    incorrect: result.incorrect_count, unanswered: result.unanswered_count,
    accuracy: Number(result.accuracy), durationSeconds: result.duration_seconds,
    questionResults: result.question_results, subjectBreakdown: result.subject_breakdown,
    markingConfig: result.marking_config_snapshot, startedAt: session.started_at,
    submittedAt: session.submitted_at, createdAt: result.created_at,
  }, 'Attempt result retrieved'))
}
