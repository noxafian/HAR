import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import type { AdminDiscussion, AdminDiscussionListResponse } from '@/types/admin-community'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive || user.role !== 'owner') {
    return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  }
  const db = await createSupabaseClient()
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  let query = db.from('discussions').select('id,author_id,title,category,reply_count,is_pinned,is_deleted,created_at', { count: 'exact' })
  if (search) query = query.ilike('title', `%${search}%`)

  const { data, error: dbError, count } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
  if (dbError) {
    console.error('[admin.community.discussions.get]', dbError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve discussions'), { status: 500 })
  }
  const authorIds = [...new Set((data ?? []).map(row => row.author_id as string).filter(Boolean))]
  const profiles = authorIds.length ? await db.from('public_profiles').select('id,display_name').in('id', authorIds) : { data: [], error: null }
  if (profiles.error) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve authors'), { status: 500 })
  const names = new Map((profiles.data ?? []).map(row => [row.id, row.display_name]))
  const items: AdminDiscussion[] = (data ?? []).map(row => ({
    id: row.id as string,
    author_id: row.author_id as string,
    author_name: names.get(row.author_id as string) ?? 'StudyHub member',
    title: row.title as string,
    category: row.category as string,
    reply_count: row.reply_count as number,
    is_pinned: row.is_pinned as boolean,
    is_deleted: row.is_deleted as boolean,
    created_at: row.created_at as string,
  }))
  const response: AdminDiscussionListResponse = { items, total: count ?? 0 }
  return NextResponse.json(createApiResponse(response, 'Discussions retrieved'))
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive || user.role !== 'owner') {
    return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id || !UUID.test(id)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid discussion ID'), { status: 400 })
  const db = await createSupabaseClient()
  const { error } = await db.rpc('soft_delete_discussion', { p_discussion_id: id })
  if (error) {
    if (error.code === 'P0002') return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Discussion not found'), { status: 404 })
    console.error('[admin.community.discussions.delete]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not delete discussion'), { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
