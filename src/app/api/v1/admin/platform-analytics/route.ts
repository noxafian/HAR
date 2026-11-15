import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import type { PlatformAnalytics, TopActiveUser, SubjectQuestionCount, DailySignup } from '@/types/admin-analytics'

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive || user.role !== 'owner') {
    return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  }
  const db = await createSupabaseClient()
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    usersRes,
    questionsRes,
    mockTestsRes,
    examResultsRes,
    activeSessionsRes,
    activeSessionsMonthRes,
    recentSignupsRes,
    profilesForNamesRes,
    subjectsRes,
  ] = await Promise.all([
    db.from('user_profiles').select('id', { count: 'exact', head: true }),
    db.from('questions').select('id,section,subject_id,is_verified', { count: 'exact' }).eq('is_deleted', false),
    db.from('mock_tests').select('id,status', { count: 'exact' }),
    db.from('exam_results').select('user_id').limit(2000),
    db.from('exam_sessions').select('user_id').gte('started_at', sevenDaysAgo).limit(2000),
    db.from('exam_sessions').select('user_id').gte('started_at', thirtyDaysAgo).limit(2000),
    db.from('user_profiles').select('id,created_at').gte('created_at', thirtyDaysAgo),
    db.from('public_profiles').select('id,display_name').limit(1000),
    db.from('subjects').select('id,name').limit(200),
  ])

  if (usersRes.error || questionsRes.error || mockTestsRes.error) {
    console.error('[admin.platform-analytics.get] core queries failed')
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve analytics data'), { status: 500 })
  }

  const total_users = usersRes.count ?? 0
  const allQuestions = questionsRes.data ?? []
  const total_questions = questionsRes.count ?? 0
  const published_questions = allQuestions.filter(q => q.is_verified === true).length
  const allMockTests = mockTestsRes.data ?? []
  const total_mock_tests = mockTestsRes.count ?? 0
  const published_mock_tests = allMockTests.filter(t => t.status === 'published').length

  // Active users via distinct user_ids from exam_sessions
  const active_last_7_days = new Set((activeSessionsRes.data ?? []).map(r => r.user_id)).size
  const active_last_30_days = new Set((activeSessionsMonthRes.data ?? []).map(r => r.user_id)).size

  // Attempt counts from exam_results
  const total_attempts = (examResultsRes.data ?? []).length
  // We can't distinguish PYQ vs mock without joining to sessions; report total as mock attempts
  const total_pyq_attempts = 0
  const total_mock_attempts = total_attempts

  // Top 5 active users: aggregate exam_results by user_id
  const attemptCounts = new Map<string, number>()
  for (const row of examResultsRes.data ?? []) {
    const uid = row.user_id as string
    attemptCounts.set(uid, (attemptCounts.get(uid) ?? 0) + 1)
  }
  const displayNames = new Map((profilesForNamesRes.data ?? []).map(r => [r.id, r.display_name as string]))
  const top_5_active_users: TopActiveUser[] = [...attemptCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([uid, count]) => ({ user_id: uid, display_name: displayNames.get(uid) ?? 'Unknown', attempt_count: count }))

  // Questions by subject
  const subjectNames = new Map((subjectsRes.data ?? []).map(r => [r.id, r.name as string]))
  const subjectCounts = new Map<string, number>()
  for (const q of allQuestions) {
    const sid = (q.subject_id ?? 'unknown') as string
    subjectCounts.set(sid, (subjectCounts.get(sid) ?? 0) + 1)
  }
  const questions_by_subject: SubjectQuestionCount[] = [...subjectCounts.entries()]
    .map(([sid, count]) => ({ subject_id: sid, subject_name: subjectNames.get(sid) ?? sid, count }))
    .sort((a, b) => b.count - a.count)

  // Daily signups last 30 days
  const signupsByDate = new Map<string, number>()
  for (const row of recentSignupsRes.data ?? []) {
    const date = new Date(row.created_at as string).toISOString().slice(0, 10)
    signupsByDate.set(date, (signupsByDate.get(date) ?? 0) + 1)
  }
  const daily_signups_last_30_days: DailySignup[] = [...signupsByDate.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const analytics: PlatformAnalytics = {
    total_users,
    active_last_7_days,
    active_last_30_days,
    total_questions,
    published_questions,
    total_mock_tests,
    published_mock_tests,
    total_pyq_attempts,
    total_mock_attempts,
    top_5_active_users,
    questions_by_subject,
    daily_signups_last_30_days,
  }

  return NextResponse.json(createApiResponse(analytics, 'Platform analytics retrieved'))
}
