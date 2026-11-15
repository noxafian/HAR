import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import type { AdminReply } from '@/types/admin-community'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive || user.role !== 'owner') {
    return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  }
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid discussion ID'), { status: 400 })
  const db = await createSupabaseClient()
  const { data, error: dbError } = await db.from('discussion_replies').select('id,discussion_id,author_id,body,is_deleted,created_at').eq('discussion_id', id).order('created_at', { ascending: true }).limit(500)
  if (dbError) {
    console.error('[admin.community.replies.get]', dbError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve replies'), { status: 500 })
  }
  const authorIds = [...new Set((data ?? []).map(row => row.author_id as string).filter(Boolean))]
  const profiles = authorIds.length ? await db.from('public_profiles').select('id,display_name').in('id', authorIds) : { data: [], error: null }
  if (profiles.error) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve authors'), { status: 500 })
  const names = new Map((profiles.data ?? []).map(row => [row.id, row.display_name]))
  const items: AdminReply[] = (data ?? []).map(row => ({
    id: row.id as string,
    discussion_id: row.discussion_id as string,
    author_id: row.author_id as string,
    author_name: names.get(row.author_id as string) ?? 'StudyHub member',
    body: row.body as string,
    is_deleted: row.is_deleted as boolean,
    created_at: row.created_at as string,
  }))
  return NextResponse.json(createApiResponse({ items }, 'Replies retrieved'))
}
