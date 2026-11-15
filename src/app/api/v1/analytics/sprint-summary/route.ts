import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { GATE_CS_DATE, GATE_DA_DATE } from '@/lib/exam-dates'

const DAY_MS = 86_400_000

type QuestionResult = { questionId?: string; outcome?: string }
type ExamResultRow = { accuracy: number; created_at: string; question_results: QuestionResult[] }
type MistakeRow = { topic_id: string | null; subject_id: string | null; created_at: string }
type FocusRow = { start_time: string; duration_minutes: number }
type TopicRow = { id: string; name: string; subject_id: string | null }
type SubjectRow = { id: string; name: string }
type QuestionRow = { id: string; topic_id: string | null }

function isoWeekOf(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum) // nearest Thursday defines the ISO year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}
function isoWeekLabel(date: Date): string {
  const { year, week } = isoWeekOf(date)
  return `${year}-W${String(week).padStart(2, '0')}`
}
function lastNWeekLabels(n: number, anchor = new Date()): string[] {
  const monday = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()))
  const dayNum = monday.getUTCDay() || 7
  monday.setUTCDate(monday.getUTCDate() - (dayNum - 1)) // Monday of anchor's ISO week
  const labels: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const weekDate = new Date(monday)
    weekDate.setUTCDate(monday.getUTCDate() - i * 7)
    labels.push(isoWeekLabel(weekDate))
  }
  return labels
}

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive) return NextResponse.json(createErrorResponse(ErrorCodes.MEMBERSHIP_PENDING.id, ErrorCodes.MEMBERSHIP_PENDING.message), { status: 403 })
  const supabase = await createSupabaseClient()

  const paper = user.examPapers[0] ?? 'CS'
  const examDate = paper === 'DA' ? GATE_DA_DATE : GATE_CS_DATE
  const daysRemaining = Math.max(0, Math.floor((examDate.getTime() - Date.now()) / DAY_MS))

  const now = Date.now()
  const ninetyDaysAgo = new Date(now - 90 * DAY_MS).toISOString()
  const fourWeeksAgo = new Date(now - 28 * DAY_MS).toISOString()

  const [resultsRes, mistakesRes, subjectsRes, topicsRes, revisionRes, focusRes] = await Promise.all([
    supabase.from('exam_results').select('accuracy,created_at,question_results').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500),
    supabase.from('mistakes').select('topic_id,subject_id,created_at').eq('user_id', user.id).gte('created_at', ninetyDaysAgo).limit(1000),
    supabase.from('subjects').select('id,name'),
    supabase.from('topics').select('id,name,subject_id'),
    supabase.from('revision_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id).in('status', ['due', 'overdue']),
    supabase.from('focus_sessions').select('start_time,duration_minutes').eq('user_id', user.id).gte('start_time', fourWeeksAgo).limit(1000),
  ])
  const firstError = resultsRes.error ?? mistakesRes.error ?? subjectsRes.error ?? topicsRes.error ?? revisionRes.error ?? focusRes.error
  if (firstError) {
    console.error('[analytics.sprint-summary]', firstError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not calculate sprint summary'), { status: 500 })
  }

  const results = (resultsRes.data ?? []) as ExamResultRow[]
  const mistakes = (mistakesRes.data ?? []) as MistakeRow[]
  const focusSessions = (focusRes.data ?? []) as FocusRow[]
  const dueRevisionCount = revisionRes.count ?? 0

  const topicById = new Map<string, TopicRow>()
  for (const t of (topicsRes.data ?? []) as TopicRow[]) topicById.set(t.id, t)
  const subjectById = new Map<string, string>()
  for (const s of (subjectsRes.data ?? []) as SubjectRow[]) subjectById.set(s.id, s.name)

  // Per-topic accuracy from exam attempts — mirrors analytics/summary attemptsByTopic.
  const questionIds = [...new Set(results.flatMap(row => Array.isArray(row.question_results) ? row.question_results.map(q => q.questionId).filter((id): id is string => typeof id === 'string') : []))]
  const questionTopic = new Map<string, string>()
  if (questionIds.length) {
    const { data: questions, error: questionError } = await supabase.from('questions').select('id,topic_id').in('id', questionIds)
    if (questionError) {
      console.error('[analytics.sprint-summary.questions]', questionError.message)
      return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not calculate topic accuracy'), { status: 500 })
    }
    for (const q of (questions ?? []) as QuestionRow[]) {
      if (q.topic_id) questionTopic.set(q.id, q.topic_id)
    }
  }
  const attemptsByTopic = new Map<string, { attempted: number; correct: number }>()
  for (const result of results) {
    for (const item of result.question_results ?? []) {
      if (!item.questionId) continue
      const topicId = questionTopic.get(item.questionId)
      if (!topicId) continue
      const agg = attemptsByTopic.get(topicId) ?? { attempted: 0, correct: 0 }
      agg.attempted += 1
      if (item.outcome === 'correct') agg.correct += 1
      attemptsByTopic.set(topicId, agg)
    }
  }

  // Mistake counts per topic over the last 90 days.
  const mistakeByTopic = new Map<string, { topicName: string; subjectName: string; count: number }>()
  for (const row of mistakes) {
    if (!row.topic_id) continue
    const topic = topicById.get(row.topic_id)
    const topicName = topic?.name ?? 'Unknown topic'
    const subjectId = row.subject_id ?? topic?.subject_id ?? null
    const subjectName = (subjectId && subjectById.get(subjectId)) ?? 'General'
    const existing = mistakeByTopic.get(row.topic_id)
    if (existing) existing.count += 1
    else mistakeByTopic.set(row.topic_id, { topicName, subjectName, count: 1 })
  }

  const weakestTopics = [...mistakeByTopic.entries()].map(([topicId, info]) => {
    const agg = attemptsByTopic.get(topicId)
    const accuracy = agg && agg.attempted ? Number(((agg.correct / agg.attempted) * 100).toFixed(2)) : null
    return { topic: info.topicName, subject: info.subjectName, mistakeCount: info.count, accuracy }
  }).sort((a, b) => b.mistakeCount - a.mistakeCount || (b.accuracy ?? 0) - (a.accuracy ?? 0)).slice(0, 5)

  // Last 30 days mock attempts + average score.
  const thirtyDaysAgoMs = now - 30 * DAY_MS
  const recentResults = results.filter(row => new Date(row.created_at).getTime() >= thirtyDaysAgoMs)
  const mockAttemptsLast30Days = recentResults.length
  const avgScoreLast30Days = mockAttemptsLast30Days ? Number((recentResults.reduce((sum, row) => sum + row.accuracy, 0) / mockAttemptsLast30Days).toFixed(2)) : 0

  // Weekly trend over the last 4 ISO weeks.
  const weekLabels = lastNWeekLabels(4)
  const weekBuckets = new Map<string, { scoreSum: number; scoreCount: number; studyMinutes: number }>(weekLabels.map(label => [label, { scoreSum: 0, scoreCount: 0, studyMinutes: 0 }]))
  for (const row of results) {
    const bucket = weekBuckets.get(isoWeekLabel(new Date(row.created_at)))
    if (bucket) { bucket.scoreSum += row.accuracy; bucket.scoreCount += 1 }
  }
  for (const row of focusSessions) {
    const bucket = weekBuckets.get(isoWeekLabel(new Date(row.start_time)))
    if (bucket) bucket.studyMinutes += row.duration_minutes
  }
  const weeklyTrend = weekLabels.map(label => {
    const b = weekBuckets.get(label)!
    return { week: label, avgScore: b.scoreCount ? Number((b.scoreSum / b.scoreCount).toFixed(2)) : 0, studyMinutes: b.studyMinutes }
  })

  // Suggested action for today.
  const threeDaysAgoMs = now - 3 * DAY_MS
  const hasRecentResult = results.some(row => new Date(row.created_at).getTime() >= threeDaysAgoMs)
  const suggestedAction = !hasRecentResult
    ? 'Take a full mock test'
    : dueRevisionCount > 0
      ? 'Review due topics'
      : 'Practice weak topics'

  return NextResponse.json(createApiResponse({
    daysRemaining,
    paper,
    mockAttemptsLast30Days,
    avgScoreLast30Days,
    weeklyTrend,
    weakestTopics,
    dueRevisionCount,
    suggestedAction,
  }, 'Sprint summary calculated'))
}
