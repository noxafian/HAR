import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { resolveSubjectTopic } from '@/lib/server/study-lookup'
import { CreateFocusSessionSchema } from '@/schemas/planner.schema'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  const supabase = await createSupabaseClient()
  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  let query = supabase.from('focus_sessions').select('id,start_time,end_time,duration_minutes,subject_id,topic_id,session_type,created_at', { count: 'exact' }).eq('user_id', user.id).order('start_time', { ascending: false })
  if (from) query = query.gte('start_time', from)
  if (to) query = query.lte('start_time', to)
  const { data, error, count } = await query.limit(100)
  if (error) {
    console.error('[planner.focus.get]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve focus sessions'), { status: 500 })
  }
  return NextResponse.json(createApiResponse({ items: data ?? [], total: count ?? 0 }, 'Focus sessions retrieved'))
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = CreateFocusSessionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })
  const start = new Date(parsed.data.startTime)
  const end = new Date(parsed.data.endTime)
  if (end <= start) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'End time must be after start time'), { status: 400 })
  const supabase = await createSupabaseClient()
  const resolved = await resolveSubjectTopic(supabase, parsed.data.subject, parsed.data.topic)
  if (resolved.error) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, resolved.error), { status: 400 })
  const { data, error } = await supabase.from('focus_sessions').insert({
    user_id: user.id, start_time: start.toISOString(), end_time: end.toISOString(),
    duration_minutes: parsed.data.durationMinutes, subject_id: resolved.subjectId,
    topic_id: resolved.topicId, session_type: parsed.data.sessionType,
  }).select('id,start_time,end_time,duration_minutes,subject_id,topic_id,session_type,created_at').single()
  if (error) {
    console.error('[planner.focus.post]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not record focus session'), { status: 500 })
  }
  return NextResponse.json(createApiResponse(data, 'Focus session recorded'), { status: 201 })
}
