import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive) return NextResponse.json(createErrorResponse(ErrorCodes.MEMBERSHIP_PENDING.id, ErrorCodes.MEMBERSHIP_PENDING.message), { status: 403 })
  const db = await createSupabaseClient()
  const { data, error } = await db.from('announcements').select('id,author_id,title,body,is_pinned,expires_at,created_at').eq('published', true).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50)
  if (error) {
    console.error('[community.announcements.get]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve announcements'), { status: 500 })
  }
  const authorIds = [...new Set((data ?? []).map(row => row.author_id))]
  const profiles = authorIds.length ? await db.from('public_profiles').select('id,display_name').in('id', authorIds) : { data: [], error: null }
  if (profiles.error) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve announcement authors'), { status: 500 })
  const names = new Map((profiles.data ?? []).map(row => [row.id, row.display_name]))
  return NextResponse.json(createApiResponse({ items: (data ?? []).map(row => ({ ...row, author_name: names.get(row.author_id) ?? 'StudyHub admin' })) }, 'Announcements retrieved'))
}
