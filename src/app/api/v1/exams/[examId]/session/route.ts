/** POST /api/v1/exams/[examId]/session — create or resume a server-timed attempt. */
import { NextResponse } from 'next/server'
import { requireApprovedMember } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { logAuditEvent } from '@/security/audit'

type Ctx = { params: Promise<{ examId: string }> }
export async function POST(_req: Request, { params }: Ctx) {
  const user = await requireApprovedMember().catch((error: unknown) => {
    const status = (error as { status?: number }).status ?? 401
    return status === 403 ? 'membership-denied' : null
  })
  if (user === null) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (user === 'membership-denied') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required'), { status: 403 })
  const { examId } = await params
  const supabase = await createSupabaseClient()
  const { data: sessionId, error: createError } = await supabase.rpc('create_exam_session', { p_mock_test_id: examId })
  if (createError || !sessionId) {
    const status = createError?.code === 'P0002' ? 404 : createError?.code === '42501' ? 403 : 500
    return NextResponse.json(createErrorResponse(status === 404 ? ErrorCodes.RESOURCE_NOT_FOUND.id : status === 403 ? ErrorCodes.INSUFFICIENT_PERMISSIONS.id : ErrorCodes.INTERNAL_SERVER_ERROR.id, status === 500 ? 'Exam session could not be started' : createError?.message ?? 'Exam unavailable'), { status })
  }

  const { data: session, error: sessionError } = await supabase.from('exam_sessions')
    .select('id,mock_test_id,paper,status,started_at,expires_at,question_count,max_possible_marks')
    .eq('id', sessionId).eq('user_id', user.id).single()
  if (sessionError || !session || session.mock_test_id !== examId) {
    return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Exam session could not be loaded'), { status: 500 })
  }
  const [
    { data: test, error: testError },
    { data: mappings, error: mappingError },
    { data: savedAnswerRows, error: savedAnswerError },
    { data: databaseNow, error: clockError },
  ] = await Promise.all([
    supabase.from('mock_tests').select('title,duration_minutes,paper').eq('id', examId).single(),
    supabase.from('mock_test_questions').select('question_id,display_order').eq('mock_test_id', examId).order('display_order', { ascending: true }),
    supabase.from('exam_answers').select('question_id,answer,marked_review').eq('session_id', session.id),
    supabase.rpc('get_server_time'),
  ])
  if (testError || mappingError || !mappings || savedAnswerError || !savedAnswerRows || clockError || !databaseNow) {
    console.error('[exams.session.load]', testError?.message, mappingError?.message, savedAnswerError?.message, clockError?.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Exam session state could not be loaded'), { status: 500 })
  }

  const ids = mappings.map(row => row.question_id)
  const { data: dbQuestions, error: questionError } = ids.length
    ? await supabase.from('questions').select('id,type,category,section,year,subject_id,topic_id,prompt,options,marks,difficulty,source_ref,is_verified').in('id', ids)
    : { data: [], error: null }
  if (questionError || !dbQuestions) return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Exam questions could not be loaded'), { status: 500 })
  const questionMap = new Map(dbQuestions.map(question => [question.id, question]))
  const questions = mappings.flatMap(mapping => {
    const question = questionMap.get(mapping.question_id)
    if (!question) return []
    return [{
      id: question.id, type: question.type, category: question.category,
      section: question.section, year: question.year, subjectId: question.subject_id,
      topicId: question.topic_id, text: question.prompt, options: question.options,
      marks: Number(question.marks), difficulty: question.difficulty,
      sourceReference: question.source_ref,
    }]
  })
  if (questions.length !== session.question_count) {
    return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Published exam definition is inconsistent'), { status: 500 })
  }
  await logAuditEvent('exam.session_started', user.id, 'exam_session', session.id, { status: 'success', metadata: { mockTestId: examId } })
  return NextResponse.json(createApiResponse({
    sessionId: session.id, examId, paper: session.paper, title: test.title,
    serverStartTime: session.started_at, serverNow: databaseNow, expiresAt: session.expires_at,
    durationSeconds: Number(test.duration_minutes) * 60,
    totalQuestions: session.question_count, totalMarks: Number(session.max_possible_marks),
    status: session.status, questions,
    savedAnswers: Object.fromEntries(savedAnswerRows.map(row => [row.question_id, {
      answer: row.answer,
      markedForReview: row.marked_review,
    }])),
  }, 'Session started or resumed'), { status: 200 })
}
