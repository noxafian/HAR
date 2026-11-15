import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createErrorResponse, ErrorCodes } from '@/lib/server/response'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive || user.role !== 'owner') {
    return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  }
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid reply ID'), { status: 400 })
  const db = await createSupabaseClient()
  // Fetch the reply first to get discussion_id for reply_count decrement
  const { data: reply } = await db.from('discussion_replies').select('id,discussion_id,is_deleted').eq('id', id).maybeSingle()
  if (!reply) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Reply not found'), { status: 404 })
  // Soft delete the reply
  const { error: deleteError } = await db.from('discussion_replies').update({ is_deleted: true }).eq('id', id)
  if (deleteError) {
    console.error('[admin.community.replies.delete]', deleteError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not delete reply'), { status: 500 })
  }
  // Decrement reply_count on the discussion (only if it wasn't already deleted)
  if (!reply.is_deleted) {
    // Use a raw update to decrement reply_count — no custom RPC required
    await db.rpc('decrement_reply_count', { p_discussion_id: reply.discussion_id }).then(
      () => {/* success */},
      (err: unknown) => {
        // Non-fatal: if the RPC doesn't exist, skip silently
        console.error('[admin.community.replies.delete] decrement reply_count', err)
      }
    )
  }
  return new NextResponse(null, { status: 204 })
}
