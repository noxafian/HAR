import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { resolveSubjectTopic } from '@/lib/server/study-lookup'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

const CreateRevisionSchema = z.object({
  subject: z.string().min(1).max(100),
  topic: z.string().trim().min(1).max(100),
  intervalDays: z.number().int().min(1).max(365).default(7),
})

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  const supabase = await createSupabaseClient()
  const [{ data: items, error }, { data: history, error: historyError }, { data: subjects, error: subjectError }, { data: topics, error: topicError }] = await Promise.all([
    supabase.from('revision_items').select('id,subject_id,topic_id,topic_label,status,scheduled_date,last_revised_at,revision_count,interval_days,created_at').eq('user_id', user.id).order('scheduled_date', { ascending: true, nullsFirst: false }),
    supabase.from('revision_history').select('id,subject_id,topic_label,reviewed_at,interval_days,revision_number').eq('user_id', user.id).order('reviewed_at', { ascending: false }).limit(100),
    supabase.from('subjects').select('id,name'),
    supabase.from('topics').select('id,name'),
  ])
  if (error || historyError || subjectError || topicError) {
    console.error('[revision.items.get]', error?.message, historyError?.message, subjectError?.message, topicError?.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve revision schedule'), { status: 500 })
  }
  const subjectNames = new Map((subjects ?? []).map(row => [row.id, row.name]))
  const topicNames = new Map((topics ?? []).map(row => [row.id, row.name]))
  const today = new Date().toISOString().slice(0, 10)
  const mapped = (items ?? []).map(item => {
    const dueDate = item.scheduled_date
    const status = item.status === 'completed' ? 'completed' : !dueDate || dueDate > today ? 'scheduled' : dueDate < today ? 'overdue' : 'due'
    return { ...item, subject: item.subject_id ? subjectNames.get(item.subject_id) ?? 'Uncategorised' : 'Uncategorised', topic: item.topic_id ? topicNames.get(item.topic_id) ?? item.topic_label ?? 'Topic' : item.topic_label ?? 'Topic', dueDate, intervalDays: item.interval_days, status }
  })
  const historyMapped = (history ?? []).map(item => ({ ...item, subject: item.subject_id ? subjectNames.get(item.subject_id) ?? 'Uncategorised' : 'Uncategorised' }))
  return NextResponse.json(createApiResponse({ items: mapped, history: historyMapped }, 'Revision schedule retrieved'))
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive) return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required'), { status: 403 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = CreateRevisionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Invalid revision item'), { status: 400 })
  const supabase = await createSupabaseClient()
  const resolved = await resolveSubjectTopic(supabase, parsed.data.subject, parsed.data.topic)
  if (resolved.error) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, resolved.error), { status: 400 })
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + parsed.data.intervalDays)
  const { data, error } = await supabase.from('revision_items').insert({
    user_id: user.id, subject_id: resolved.subjectId, topic_id: resolved.topicId,
    topic_label: resolved.topicLabel, interval_days: parsed.data.intervalDays,
    status: 'not-started', scheduled_date: dueDate.toISOString().slice(0, 10),
  }).select('id,subject_id,topic_id,topic_label,status,scheduled_date,revision_count,interval_days,created_at').single()
  if (error || !data) {
    console.error('[revision.items.post]', error?.message)
    return NextResponse.json(createErrorResponse(error?.code === '23505' ? ErrorCodes.RESOURCE_CONFLICT.id : ErrorCodes.DATABASE_ERROR.id, error?.code === '23505' ? 'This topic is already on your revision schedule' : 'Could not schedule revision'), { status: error?.code === '23505' ? 409 : 500 })
  }
  return NextResponse.json(createApiResponse({ ...data, subject: parsed.data.subject, topic: resolved.topicLabel, dueDate: data.scheduled_date, intervalDays: data.interval_days, status: 'scheduled' }, 'Revision scheduled'), { status: 201 })
}
