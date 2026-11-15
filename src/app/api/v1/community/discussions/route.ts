import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { resolveSubjectTopic } from '@/lib/server/study-lookup'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

const CreateDiscussionSchema = z.object({
  title: z.string().min(5).max(200).trim(),
  body: z.string().min(10).max(20000).trim(),
  subject: z.string().max(100).trim().optional(),
  topic: z.string().max(100).trim().optional(),
  category: z.enum(['doubt','resource-recommendation','question-of-the-day','weekly-challenge','general']).optional().default('general'),
})

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive) return NextResponse.json(createErrorResponse(ErrorCodes.MEMBERSHIP_PENDING.id, ErrorCodes.MEMBERSHIP_PENDING.message), { status: 403 })
  const supabase = await createSupabaseClient()
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit') || 30), 1), 100)
  const offset = Math.max(Number(req.nextUrl.searchParams.get('offset') || 0), 0)
  let query = supabase.from('discussions').select('id,author_id,title,body,category,subject_id,topic_id,reply_count,is_pinned,created_at,updated_at', { count: 'exact' }).eq('is_deleted', false).order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
  const category = req.nextUrl.searchParams.get('category')
  if (category) query = query.eq('category', category)
  const { data, error, count } = await query.range(offset, offset + limit - 1)
  if (error) {
    console.error('[community.discussions.get]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve discussions'), { status: 500 })
  }
  const authorIds = [...new Set((data ?? []).map(row => row.author_id))]
  const subjectIds = [...new Set((data ?? []).map(row => row.subject_id).filter((id): id is string => Boolean(id)))]
  const [profiles, subjects] = await Promise.all([
    authorIds.length ? supabase.from('public_profiles').select('id,display_name').in('id', authorIds) : Promise.resolve({ data: [], error: null }),
    subjectIds.length ? supabase.from('subjects').select('id,name').in('id', subjectIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (profiles.error || subjects.error) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not resolve discussion authors'), { status: 500 })
  const authors = new Map((profiles.data ?? []).map(row => [row.id, row.display_name]))
  const subjectNames = new Map((subjects.data ?? []).map(row => [row.id, row.name]))
  const items = (data ?? []).map(row => ({ ...row, author_name: authors.get(row.author_id) ?? 'StudyHub member', subject_name: row.subject_id ? subjectNames.get(row.subject_id) ?? 'General' : 'General' }))
  return NextResponse.json(createApiResponse({ items, total: count ?? 0, limit, offset }, 'Discussions retrieved'))
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive) return NextResponse.json(createErrorResponse(ErrorCodes.MEMBERSHIP_PENDING.id, ErrorCodes.MEMBERSHIP_PENDING.message), { status: 403 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = CreateDiscussionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })
  const supabase = await createSupabaseClient()
  const resolved = await resolveSubjectTopic(supabase, parsed.data.subject, parsed.data.topic)
  if (resolved.error) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, resolved.error), { status: 400 })
  if (resolved.topicLabel && !resolved.topicId) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Choose an existing syllabus topic for this shared item'), { status: 400 })
  const { data, error } = await supabase.from('discussions').insert({
    author_id: user.id, title: parsed.data.title, body: parsed.data.body,
    category: parsed.data.category, subject_id: resolved.subjectId, topic_id: resolved.topicId,
  }).select('id,author_id,title,body,category,subject_id,topic_id,reply_count,created_at').single()
  if (error) {
    console.error('[community.discussions.post]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not create discussion'), { status: 500 })
  }
  return NextResponse.json(createApiResponse(data, 'Discussion created'), { status: 201 })
}
