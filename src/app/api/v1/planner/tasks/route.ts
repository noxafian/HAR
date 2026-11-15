import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { resolveSubjectTopic } from '@/lib/server/study-lookup'
import { CreateTaskSchema } from '@/schemas/planner.schema'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  const params = req.nextUrl.searchParams
  const supabase = await createSupabaseClient()
  let query = supabase.from('planner_tasks').select('id,title,description,subject_id,topic_id,topic_label,scheduled_date,estimated_mins,priority,completed,completed_at,created_at,updated_at', { count: 'exact' }).eq('user_id', user.id).order('scheduled_date', { ascending: true }).order('created_at', { ascending: true })
  const from = params.get('from')
  const to = params.get('to')
  if (from) query = query.gte('scheduled_date', from)
  if (to) query = query.lte('scheduled_date', to)
  if (params.get('completed') === 'true') query = query.eq('completed', true)
  if (params.get('completed') === 'false') query = query.eq('completed', false)
  const { data, error, count } = await query
  if (error) {
    console.error('[planner.tasks.get]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve tasks'), { status: 500 })
  }
  const subjectIds = [...new Set((data ?? []).map(row => row.subject_id).filter((id): id is string => Boolean(id)))]
  const subjectRes = subjectIds.length ? await supabase.from('subjects').select('id,name').in('id', subjectIds) : { data: [], error: null }
  if (subjectRes.error) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not resolve task subjects'), { status: 500 })
  const subjectNames = new Map((subjectRes.data ?? []).map(row => [row.id, row.name]))
  const items = (data ?? []).map(row => ({ ...row, subject_name: row.subject_id ? subjectNames.get(row.subject_id) ?? 'Uncategorised' : 'Uncategorised' }))
  return NextResponse.json(createApiResponse({ items, total: count ?? 0 }, 'Tasks retrieved'))
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = CreateTaskSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })
  const supabase = await createSupabaseClient()
  const resolved = await resolveSubjectTopic(supabase, parsed.data.subject, parsed.data.topic)
  if (resolved.error) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, resolved.error), { status: 400 })
  const { data, error } = await supabase.from('planner_tasks').insert({
    user_id: user.id, title: parsed.data.title, description: parsed.data.description ?? null,
    subject_id: resolved.subjectId, topic_id: resolved.topicId, topic_label: resolved.topicLabel, scheduled_date: parsed.data.scheduledDate,
    estimated_mins: parsed.data.estimatedMinutes ?? null, priority: parsed.data.priority,
  }).select('id,title,description,subject_id,topic_id,topic_label,scheduled_date,estimated_mins,priority,completed,created_at').single()
  if (error) {
    console.error('[planner.tasks.post]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not create task'), { status: 500 })
  }
  return NextResponse.json(createApiResponse(data, 'Task created'), { status: 201 })
}
