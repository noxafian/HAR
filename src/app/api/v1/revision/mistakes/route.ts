import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { resolveSubjectTopic } from '@/lib/server/study-lookup'
import { CreateMistakeSchema } from '@/schemas/revision.schema'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  const search = req.nextUrl.searchParams
  const supabase = await createSupabaseClient()
  let query = supabase.from('mistakes').select('id,question_id,question_text,my_answer,correct_answer,subject_id,topic_id,topic_label,notes,category,resolved,created_at,updated_at', { count: 'exact' }).eq('user_id', user.id).order('created_at', { ascending: false })
  if (search.get('resolved') === 'true') query = query.eq('resolved', true)
  if (search.get('resolved') === 'false') query = query.eq('resolved', false)
  const limit = Math.min(Math.max(Number(search.get('limit') || 50), 1), 100)
  const offset = Math.max(Number(search.get('offset') || 0), 0)
  const { data, error, count } = await query.range(offset, offset + limit - 1)
  if (error) {
    console.error('[revision.mistakes.get]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve mistakes'), { status: 500 })
  }
  const subjectIds = [...new Set((data ?? []).map(row => row.subject_id).filter((id): id is string => Boolean(id)))]
  const topicIds = [...new Set((data ?? []).map(row => row.topic_id).filter((id): id is string => Boolean(id)))]
  const [subjects, topics] = await Promise.all([
    subjectIds.length ? supabase.from('subjects').select('id,name').in('id', subjectIds) : Promise.resolve({ data: [], error: null }),
    topicIds.length ? supabase.from('topics').select('id,name').in('id', topicIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (subjects.error || topics.error) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not resolve mistake subjects'), { status: 500 })
  const subjectNames = new Map((subjects.data ?? []).map(row => [row.id, row.name]))
  const topicNames = new Map((topics.data ?? []).map(row => [row.id, row.name]))
  const items = (data ?? []).map(item => ({ ...item, subject_name: item.subject_id ? subjectNames.get(item.subject_id) ?? 'Uncategorised' : 'Uncategorised', topic_name: item.topic_id ? topicNames.get(item.topic_id) ?? item.topic_label ?? 'General' : item.topic_label ?? 'General' }))
  return NextResponse.json(createApiResponse({ items, total: count ?? 0, limit, offset }, 'Mistakes retrieved'))
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = CreateMistakeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })
  const supabase = await createSupabaseClient()
  const resolved = await resolveSubjectTopic(supabase, parsed.data.subject, parsed.data.topic)
  if (resolved.error) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, resolved.error), { status: 400 })
  const { data, error } = await supabase.from('mistakes').insert({
    user_id: user.id,
    question_id: parsed.data.questionId ?? null,
    question_text: parsed.data.questionText,
    my_answer: parsed.data.myAnswer,
    correct_answer: parsed.data.correctAnswer,
    subject_id: resolved.subjectId,
    topic_id: resolved.topicId,
    topic_label: resolved.topicLabel,
    notes: parsed.data.notes ?? null,
    category: parsed.data.category,
  }).select('id,question_id,question_text,my_answer,correct_answer,subject_id,topic_id,topic_label,notes,category,resolved,created_at').single()
  if (error) {
    console.error('[revision.mistakes.post]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not record mistake'), { status: 500 })
  }
  return NextResponse.json(createApiResponse(data, 'Mistake recorded'), { status: 201 })
}
