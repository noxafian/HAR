/** PATCH/DELETE /api/v1/admin/videos/[id] — owner-only (service-role, bypasses RLS). */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createServiceRoleClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VIDEO_COLUMNS = 'id,paper,subject_name,topic_name,youtube_id,title,description,duration_seconds,display_order,is_published,created_by,created_at,updated_at'

const PatchVideoSchema = z.object({
  paper: z.enum(['CS', 'DA', 'GA']).optional(),
  subject_name: z.string().min(1).max(200).trim().optional(),
  topic_name: z.string().min(1).max(200).trim().nullable().optional(),
  youtube_id: z.string().regex(/^[a-zA-Z0-9_-]{4,20}$/).optional(),
  title: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(2000).trim().nullable().optional(),
  duration_seconds: z.number().int().min(1).max(86400).nullable().optional(),
  display_order: z.number().int().optional(),
  is_published: z.boolean().optional(),
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
  if (!UUID.test(id)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid video ID'), { status: 400 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = PatchVideoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, parsed.error.issues[0]?.message ?? 'Validation failed'), { status: 400 })
  }
  const db = createServiceRoleClient()
  const { data, error: dbError } = await db.from('topic_videos')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(VIDEO_COLUMNS)
    .maybeSingle()
  if (dbError) {
    console.error('[admin.videos.patch]', dbError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not update video'), { status: 500 })
  }
  if (!data) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Video not found'), { status: 404 })
  return NextResponse.json(createApiResponse(data, 'Video updated'))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await authGuard()
  if (error) return error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid video ID'), { status: 400 })
  const db = createServiceRoleClient()
  const { error: dbError } = await db.from('topic_videos').delete().eq('id', id)
  if (dbError) {
    console.error('[admin.videos.delete]', dbError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not delete video'), { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
