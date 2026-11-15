import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { resolveSubjectTopic } from '@/lib/server/study-lookup'
import { CreateFlashcardSchema } from '@/schemas/revision.schema'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  const supabase = await createSupabaseClient()
  const search = req.nextUrl.searchParams
  let query = supabase.from('flashcards').select('id,front,back,subject_id,topic_id,topic_label,source,is_ai_generated,difficulty,next_review_at,review_count,is_remembered,is_difficult,created_at,updated_at', { count: 'exact' }).eq('user_id', user.id).order('next_review_at', { ascending: true, nullsFirst: true }).order('created_at', { ascending: false })
  if (search.get('dueOnly') === 'true') query = query.lte('next_review_at', new Date().toISOString())
  const limit = Math.min(Math.max(Number(search.get('limit') || 50), 1), 100)
  const offset = Math.max(Number(search.get('offset') || 0), 0)
  query = query.range(offset, offset + limit - 1)
  const { data, error, count } = await query
  if (error) {
    console.error('[revision.flashcards.get]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve flashcards'), { status: 500 })
  }
  const subjectIds = [...new Set((data ?? []).map(row => row.subject_id).filter((id): id is string => Boolean(id)))]
  const topicIds = [...new Set((data ?? []).map(row => row.topic_id).filter((id): id is string => Boolean(id)))]
  const [subjects, topics] = await Promise.all([
    subjectIds.length ? supabase.from('subjects').select('id,name').in('id', subjectIds) : Promise.resolve({ data: [], error: null }),
    topicIds.length ? supabase.from('topics').select('id,name').in('id', topicIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (subjects.error || topics.error) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not resolve flashcard subjects'), { status: 500 })
  const subjectNames = new Map((subjects.data ?? []).map(row => [row.id, row.name]))
  const topicNames = new Map((topics.data ?? []).map(row => [row.id, row.name]))
  const items = (data ?? []).map(row => ({ ...row, subject_name: row.subject_id ? subjectNames.get(row.subject_id) ?? 'Uncategorised' : 'Uncategorised', topic_name: row.topic_id ? topicNames.get(row.topic_id) ?? row.topic_label ?? 'General' : row.topic_label ?? 'General' }))
  return NextResponse.json(createApiResponse({ items, total: count ?? 0, limit, offset }, 'Flashcards retrieved'))
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = CreateFlashcardSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })
  const supabase = await createSupabaseClient()
  const resolved = await resolveSubjectTopic(supabase, parsed.data.subject, parsed.data.topic)
  if (resolved.error) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, resolved.error), { status: 400 })
  const { data, error } = await supabase.from('flashcards').insert({
    user_id: user.id, front: parsed.data.front, back: parsed.data.back,
    subject_id: resolved.subjectId, topic_id: resolved.topicId, topic_label: resolved.topicLabel, source: parsed.data.source ?? null,
    is_ai_generated: parsed.data.isAiGenerated, difficulty: parsed.data.difficulty,
  }).select('id,front,back,subject_id,topic_id,topic_label,source,is_ai_generated,difficulty,next_review_at,review_count,created_at').single()
  if (error) {
    console.error('[revision.flashcards.post]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not create flashcard'), { status: 500 })
  }
  const [subject, topic] = await Promise.all([
    resolved.subjectId ? supabase.from('subjects').select('name').eq('id', resolved.subjectId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    resolved.topicId ? supabase.from('topics').select('name').eq('id', resolved.topicId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  return NextResponse.json(createApiResponse({ ...data, subject_name: subject.data?.name ?? 'Uncategorised', topic_name: topic.data?.name ?? 'General' }, 'Flashcard created'), { status: 201 })
}
