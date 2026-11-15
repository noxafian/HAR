import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

const DAY_MS = 86_400_000

type ExamResultRow = { accuracy: number; created_at: string }
type FocusRow = { start_time: string; duration_minutes: number }

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

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive) return NextResponse.json(createErrorResponse(ErrorCodes.MEMBERSHIP_PENDING.id, ErrorCodes.MEMBERSHIP_PENDING.message), { status: 403 })
  const supabase = await createSupabaseClient()

  const rawWeeks = Number(req.nextUrl.searchParams.get('weeks') ?? '8')
  const weeks = Number.isFinite(rawWeeks) && rawWeeks > 0 ? Math.min(26, Math.max(1, Math.round(rawWeeks))) : 8
  const windowStart = new Date(Date.now() - weeks * 7 * DAY_MS).toISOString()

  const [resultsRes, focusRes] = await Promise.all([
    supabase.from('exam_results').select('accuracy,created_at').eq('user_id', user.id).gte('created_at', windowStart).order('created_at', { ascending: true }).limit(1000),
    supabase.from('focus_sessions').select('start_time,duration_minutes').eq('user_id', user.id).gte('start_time', windowStart).order('start_time', { ascending: true }).limit(1000),
  ])
  const firstError = resultsRes.error ?? focusRes.error
  if (firstError) {
    console.error('[analytics.trend]', firstError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not calculate trend'), { status: 500 })
  }

  const results = (resultsRes.data ?? []) as ExamResultRow[]
  const focusSessions = (focusRes.data ?? []) as FocusRow[]

  const weekLabels = lastNWeekLabels(weeks)
  const buckets = new Map<string, { scoreSum: number; scoreCount: number; studyMinutes: number; mockCount: number }>(weekLabels.map(label => [label, { scoreSum: 0, scoreCount: 0, studyMinutes: 0, mockCount: 0 }]))
  for (const row of results) {
    const bucket = buckets.get(isoWeekLabel(new Date(row.created_at)))
    if (bucket) { bucket.scoreSum += row.accuracy; bucket.scoreCount += 1; bucket.mockCount += 1 }
  }
  for (const row of focusSessions) {
    const bucket = buckets.get(isoWeekLabel(new Date(row.start_time)))
    if (bucket) bucket.studyMinutes += row.duration_minutes
  }
  const weeksData = weekLabels.map(label => {
    const b = buckets.get(label)!
    const avg = b.scoreCount ? Number((b.scoreSum / b.scoreCount).toFixed(2)) : 0
    return { weekLabel: label, avgScore: avg, accuracy: avg, studyMinutes: b.studyMinutes, mockCount: b.mockCount }
  })

  return NextResponse.json(createApiResponse({ weeks: weeksData }, 'Trend calculated'))
}
