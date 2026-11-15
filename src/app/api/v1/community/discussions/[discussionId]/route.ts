import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_req: NextRequest, { params }: { params: Promise<{ discussionId: string }> }) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive) return NextResponse.json(createErrorResponse(ErrorCodes.MEMBERSHIP_PENDING.id, ErrorCodes.MEMBERSHIP_PENDING.message), { status: 403 })
  const { discussionId } = await params
  if (!UUID.test(discussionId)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid discussion ID'), { status: 400 })
  const supabase = await createSupabaseClient()
  const { data: discussion, error } = await supabase.from('discussions').select('id,author_id,title,body,category,subject_id,topic_id,reply_count,is_pinned,created_at,updated_at').eq('id', discussionId).eq('is_deleted', false).maybeSingle()
  if (error) {
    console.error('[community.discussion.get]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve discussion'), { status: 500 })
  }
  if (!discussion) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Discussion not found'), { status: 404 })
  const { data: replies, error: repliesError } = await supabase.from('discussion_replies').select('id,author_id,body,created_at,updated_at').eq('discussion_id', discussionId).eq('is_deleted', false).order('created_at', { ascending: true }).limit(500)
  if (repliesError) {
    console.error('[community.discussion.replies]', repliesError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve replies'), { status: 500 })
  }
  const authorIds = [...new Set([discussion.author_id, ...(replies ?? []).map(row => row.author_id)])]
  const [profiles, subjects] = await Promise.all([
    supabase.from('public_profiles').select('id,display_name').in('id', authorIds),
    discussion.subject_id ? supabase.from('subjects').select('id,name').eq('id', discussion.subject_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  if (profiles.error || subjects.error) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not resolve discussion details'), { status: 500 })
  const names = new Map((profiles.data ?? []).map(row => [row.id, row.display_name]))
  return NextResponse.json(createApiResponse({
    discussion: { ...discussion, author_name: names.get(discussion.author_id) ?? 'StudyHub member', subject_name: subjects.data?.name ?? 'General' },
    replies: (replies ?? []).map(row => ({ ...row, author_name: names.get(row.author_id) ?? 'StudyHub member' })),
  }, 'Discussion retrieved'))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ discussionId: string }> }) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (user.role !== 'owner') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  const { discussionId } = await params
  if (!UUID.test(discussionId)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid discussion ID'), { status: 400 })
  const supabase = await createSupabaseClient()
  const { error } = await supabase.rpc('soft_delete_discussion', { p_discussion_id: discussionId })
  if (error) {
    if (error.code === 'P0002') return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Discussion not found'), { status: 404 })
    if (error.code === '42501') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
    console.error('[community.discussion.delete]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not delete discussion'), { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
