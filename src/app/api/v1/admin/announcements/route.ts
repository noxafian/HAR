import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import type { AdminAnnouncement } from '@/types/admin-announcements'

const CreateAnnouncementSchema = z.object({
  title: z.string().min(5).max(200).trim(),
  body: z.string().min(1).max(20000).trim(),
  is_pinned: z.boolean().default(false),
  published: z.boolean().default(false),
  expires_at: z.string().datetime().optional(),
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
  const db = await createSupabaseClient()
  const { data, error: dbError } = await db.from('announcements').select('id,author_id,title,body,is_pinned,published,expires_at,created_at,updated_at').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(100)
  if (dbError) {
    console.error('[admin.announcements.get]', dbError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve announcements'), { status: 500 })
  }
  const authorIds = [...new Set((data ?? []).map(row => row.author_id as string).filter(Boolean))]
  const profiles = authorIds.length ? await db.from('public_profiles').select('id,display_name').in('id', authorIds) : { data: [], error: null }
  if (profiles.error) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve authors'), { status: 500 })
  const names = new Map((profiles.data ?? []).map(row => [row.id, row.display_name]))
  const items: AdminAnnouncement[] = (data ?? []).map(row => ({
    id: row.id as string,
    author_id: row.author_id as string,
    author_name: names.get(row.author_id as string) ?? 'Admin',
    title: row.title as string,
    body: row.body as string,
    is_pinned: row.is_pinned as boolean,
    published: (row.published ?? true) as boolean,
    expires_at: row.expires_at as string | null,
    created_at: row.created_at as string,
    updated_at: (row.updated_at ?? null) as string | null,
  }))
  return NextResponse.json(createApiResponse({ items }, 'Announcements retrieved'))
}

export async function POST(req: NextRequest) {
  const { error, user } = await authGuard()
  if (error || !user) return error!
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = CreateAnnouncementSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, parsed.error.issues[0]?.message ?? 'Validation failed'), { status: 400 })
  }
  const db = await createSupabaseClient()
  const { data, error: dbError } = await db.from('announcements').insert({
    author_id: user.id,
    title: parsed.data.title,
    body: parsed.data.body,
    is_pinned: parsed.data.is_pinned,
    expires_at: parsed.data.expires_at ?? null,
    published: parsed.data.published,
  }).select('id,author_id,title,body,is_pinned,published,expires_at,created_at,updated_at').single()
  if (dbError) {
    console.error('[admin.announcements.post]', dbError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not create announcement'), { status: 500 })
  }
  return NextResponse.json(createApiResponse(data, 'Announcement created'), { status: 201 })
}
