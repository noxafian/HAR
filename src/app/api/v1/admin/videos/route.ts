/** GET/POST /api/v1/admin/videos — owner-only topic video CRUD (service-role, bypasses RLS). */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createServiceRoleClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

const VIDEO_COLUMNS = 'id,paper,subject_name,topic_name,youtube_id,title,description,duration_seconds,display_order,is_published,created_by,created_at,updated_at'

const CreateVideoSchema = z.object({
  paper: z.enum(['CS', 'DA', 'GA']),
  subject_name: z.string().min(1).max(200).trim(),
  topic_name: z.string().min(1).max(200).trim().optional(),
  youtube_id: z.string().regex(/^[a-zA-Z0-9_-]{4,20}$/),
  title: z.string().min(1).max(255).trim(),
  description: z.string().max(2000).trim().optional(),
  duration_seconds: z.number().int().min(1).max(86400).optional(),
  display_order: z.number().int().optional(),
})

async function authGuard() {
  const user = await getAuthenticatedUser()
  if (!user) return { error: NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 }), user: null }
  if (!user.isActive || user.role !== 'owner') {
    return { error: NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 }), user: null }
  }
  return { error: null, user }
}

export async function GET() {
  const { error } = await authGuard()
  if (error) return error
  const db = createServiceRoleClient()
  const { data, error: dbError } = await db.from('topic_videos').select(VIDEO_COLUMNS).order('created_at', { ascending: false })
  if (dbError) {
    console.error('[admin.videos.get]', dbError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve videos'), { status: 500 })
  }
  return NextResponse.json(createApiResponse({ items: data ?? [] }, 'Videos retrieved'))
}

export async function POST(req: NextRequest) {
  const { error, user } = await authGuard()
  if (error || !user) return error!
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = CreateVideoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, parsed.error.issues[0]?.message ?? 'Validation failed'), { status: 400 })
  }
  const db = createServiceRoleClient()
  const { data, error: dbError } = await db.from('topic_videos').insert({
    paper: parsed.data.paper,
    subject_name: parsed.data.subject_name,
    topic_name: parsed.data.topic_name ?? null,
    youtube_id: parsed.data.youtube_id,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    duration_seconds: parsed.data.duration_seconds ?? null,
    display_order: parsed.data.display_order ?? 0,
    is_published: false,
    created_by: user.id,
  }).select(VIDEO_COLUMNS).single()
  if (dbError) {
    console.error('[admin.videos.post]', dbError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not create video'), { status: 500 })
  }
  return NextResponse.json(createApiResponse(data, 'Video created'), { status: 201 })
}
