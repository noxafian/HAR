import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

const MISTAKE_CATEGORIES = [
  'conceptual-misunderstanding', 'calculation-error', 'formula-forgotten',
  'question-misunderstood', 'time-management', 'incorrect-guessing',
] as const

type QuestionResult = { questionId?: string; outcome?: string }
type ResultRow = { session_id: string; total_marks: number; max_possible_marks: number; accuracy: number; created_at: string; question_results: QuestionResult[] }

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive) return NextResponse.json(createErrorResponse(ErrorCodes.MEMBERSHIP_PENDING.id, ErrorCodes.MEMBERSHIP_PENDING.message), { status: 403 })
  const supabase = await createSupabaseClient()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [resultsRes, focusRes, flashcardsRes, mistakesRes, subjectsRes, topicsRes, revisionRes, revisionHistoryRes] = await Promise.all([
    supabase.from('exam_results').select('session_id,total_marks,max_possible_marks,accuracy,created_at,question_results').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500),
    supabase.from('focus_sessions').select('start_time,duration_minutes').eq('user_id', user.id).gte('start_time', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()).order('start_time', { ascending: false }).limit(1000),
    supabase.from('flashcards').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('mistakes').select('category', { count: 'exact' }).eq('user_id', user.id),
    supabase.from('subjects').select('id,name,is_general_aptitude'),
    supabase.from('topics').select('id,name,subject_id'),
    supabase.from('revision_items').select('id,topic_id,topic_label,status,scheduled_date').eq('user_id', user.id),
    supabase.from('revision_history').select('revision_item_id', { count: 'exact' }).eq('user_id', user.id).limit(1000),
  ])
  const firstError = resultsRes.error ?? focusRes.error ?? flashcardsRes.error ?? mistakesRes.error ?? subjectsRes.error ?? topicsRes.error ?? revisionRes.error ?? revisionHistoryRes.error
  if (firstError) {
    console.error('[analytics.summary]', firstError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not calculate analytics'), { status: 500 })
  }

  const results = (resultsRes.data ?? []) as ResultRow[]
  const sessionIds = results.map(row => row.session_id)
  const { data: sessions, error: sessionError } = sessionIds.length
    ? await supabase.from('exam_sessions').select('id,paper,mock_test_id').in('id', sessionIds)
    : { data: [], error: null }
  if (sessionError) {
    console.error('[analytics.sessions]', sessionError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not calculate exam history'), { status: 500 })
  }

  const questionIds = [...new Set(results.flatMap(row => Array.isArray(row.question_results) ? row.question_results.map(q => q.questionId).filter((id): id is string => typeof id === 'string') : []))]
  const { data: questions, error: questionError } = questionIds.length
    ? await supabase.from('questions').select('id,category,subject_id,topic_id').in('id', questionIds)
    : { data: [], error: null }
  if (questionError) {
    console.error('[analytics.questions]', questionError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not calculate question analytics'), { status: 500 })
  }

  const questionById = new Map((questions ?? []).map(q => [q.id, q]))
  const subjectById = new Map((subjectsRes.data ?? []).map(subject => [subject.id, subject]))
  const topicById = new Map((topicsRes.data ?? []).map(topic => [topic.id, topic]))
  const attemptsBySubject = new Map<string, { attempted: number; correct: number }>()
  const attemptsByTopic = new Map<string, { attempted: number; correct: number }>()
  let pyqAttempted = 0
  let pyqCorrect = 0
  for (const result of results) {
    for (const item of result.question_results ?? []) {
      if (!item.questionId) continue
      const question = questionById.get(item.questionId)
      if (!question) continue
      const correct = item.outcome === 'correct'
      if (question.category === 'official-pyq') {
        pyqAttempted += 1
        if (correct) pyqCorrect += 1
      }
      if (question.subject_id) {
        const aggregate = attemptsBySubject.get(question.subject_id) ?? { attempted: 0, correct: 0 }
        aggregate.attempted += 1
        if (correct) aggregate.correct += 1
        attemptsBySubject.set(question.subject_id, aggregate)
      }
      if (question.topic_id) {
        const aggregate = attemptsByTopic.get(question.topic_id) ?? { attempted: 0, correct: 0 }
        aggregate.attempted += 1
        if (correct) aggregate.correct += 1
        attemptsByTopic.set(question.topic_id, aggregate)
      }
    }
  }

  const revisionItemById = new Map((revisionRes.data ?? []).map(item => [item.id, item]))
  const completedTopicIds = new Set((revisionHistoryRes.data ?? []).map(entry => entry.revision_item_id ? revisionItemById.get(entry.revision_item_id)?.topic_id : null).filter((id): id is string => Boolean(id)))
  const subjects = subjectsRes.data ?? []
  const topics = topicsRes.data ?? []
  const subjectProgress = subjects.map(subject => {
    const subjectTopics = topics.filter(topic => topic.subject_id === subject.id)
    const aggregate = attemptsBySubject.get(subject.id)
    return {
      subjectId: subject.id,
      subjectName: subject.name,
      topicsTotal: subjectTopics.length,
      topicsCompleted: subjectTopics.length ? subjectTopics.filter(topic => completedTopicIds.has(topic.id)).length : 0,
      pyqAttempted: aggregate?.attempted ?? 0,
      pyqAccuracy: aggregate?.attempted ? Number(((aggregate.correct / aggregate.attempted) * 100).toFixed(2)) : null,
    }
  })
  const weakTopics = [...attemptsByTopic.entries()].map(([topicId, aggregate]) => {
    const topic = topicById.get(topicId)
    return topic ? {
      topicId, topicName: topic.name, subjectId: topic.subject_id,
      accuracyPercent: Number(((aggregate.correct / aggregate.attempted) * 100).toFixed(2)),
      attemptCount: aggregate.attempted,
    } : null
  }).filter((item): item is NonNullable<typeof item> => item !== null).sort((a, b) => a.accuracyPercent - b.accuracyPercent || b.attemptCount - a.attemptCount).slice(0, 5)

  const focusSessions = focusRes.data ?? []
  const weeklyStudyMinutes = focusSessions.filter(row => row.start_time >= since).reduce((total, row) => total + row.duration_minutes, 0)
  const uniqueStudyDays = new Set(focusSessions.map(row => new Date(row.start_time).toISOString().slice(0, 10)))
  let studyStreakDays = 0
  const cursor = new Date()
  cursor.setUTCHours(0, 0, 0, 0)
  // A streak can continue through today or yesterday if today's session has not started yet.
  if (!uniqueStudyDays.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1)
  while (uniqueStudyDays.has(cursor.toISOString().slice(0, 10))) {
    studyStreakDays += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  const mistakeBreakdown = Object.fromEntries(MISTAKE_CATEGORIES.map(category => [category, (mistakesRes.data ?? []).filter(item => item.category === category).length])) as Record<(typeof MISTAKE_CATEGORIES)[number], number>
  const sessionById = new Map((sessions ?? []).map(session => [session.id, session]))
  const mockTestHistory = results.map(result => ({
    testId: result.session_id,
    attemptedAt: new Date(result.created_at),
    paper: sessionById.get(result.session_id)?.paper ?? 'unknown',
    score: null as null,
    totalMarks: result.total_marks,
    maxPossibleMarks: result.max_possible_marks,
    accuracy: result.accuracy,
  }))
  const today = new Date().toISOString().slice(0, 10)
  const revisionItems = revisionRes.data ?? []
  const revisionProgress = {
    tracked: revisionItems.length,
    reviewsRecorded: revisionHistoryRes.count ?? (revisionHistoryRes.data ?? []).length,
    due: revisionItems.filter(item => item.scheduled_date === today).length,
    overdue: revisionItems.filter(item => item.scheduled_date !== null && item.scheduled_date < today).length,
    scheduled: revisionItems.filter(item => item.scheduled_date === null || item.scheduled_date > today).length,
  }

  return NextResponse.json(createApiResponse({
    userId: user.id,
    revisionProgress,
    pyqAccuracy: pyqAttempted ? Number(((pyqCorrect / pyqAttempted) * 100).toFixed(2)) : null,
    pyqAttempted,
    mockTestsAttempted: results.length,
    mockTestHistory,
    subjectProgress,
    weakTopics,
    mistakeBreakdown,
    mistakesLogged: mistakesRes.count ?? (mistakesRes.data ?? []).length,
    flashcardsCreated: flashcardsRes.count ?? 0,
    studyStreakDays,
    totalStudyMinutes: focusSessions.reduce((total, row) => total + row.duration_minutes, 0),
    weeklyStudyMinutes,
    lastUpdated: new Date().toISOString(),
    analyticsWindow: { examAttempts: 'latest 500', focusSessions: 'last 365 days', weeklyStudyMinutes: 'last 7 days' },
  }, 'Analytics calculated from recorded study activity'))
}
