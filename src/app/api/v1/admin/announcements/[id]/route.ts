import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PatchAnnouncementSchema = z.object({
  title: z.string().min(5).max(200).trim().optional(),
  body: z.string().min(1).max(20000).trim().optional(),
  is_pinned: z.boolean().optional(),
  published: z.boolean().optional(),
  expires_at: z.string().datetime().nullable().optional(),
})

async function authGuard() {
  const user = await getAuthenticatedUser()
  if (!user) return { error: NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 }) }
  if (!user.isActive || user.role !== 'owner') {
    return { error: NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 }) }
  }
  return { error: null }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await authGuard()
  if (error) return error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid announcement ID'), { status: 400 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = PatchAnnouncementSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, parsed.error.issues[0]?.message ?? 'Validation failed'), { status: 400 })
  }
  const db = await createSupabaseClient()
  const { data, error: dbError } = await db.from('announcements').update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', id).select('id,author_id,title,body,is_pinned,published,expires_at,created_at,updated_at').maybeSingle()
  if (dbError) {
    console.error('[admin.announcements.patch]', dbError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not update announcement'), { status: 500 })
  }
  if (!data) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Announcement not found'), { status: 404 })
  return NextResponse.json(createApiResponse(data, 'Announcement updated'))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await authGuard()
  if (error) return error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid announcement ID'), { status: 400 })
  const db = await createSupabaseClient()
  const { error: dbError } = await db.from('announcements').delete().eq('id', id)
  if (dbError) {
    console.error('[admin.announcements.delete]', dbError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not delete announcement'), { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
