import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive || user.role !== 'owner') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  const search = req.nextUrl.searchParams.get('search')?.trim().slice(0, 100) || null
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') || 1) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 50) || 50))
  const db = await createSupabaseClient()
  const { data, error } = await db.rpc('admin_list_audit_events', { p_search: search, p_limit: limit, p_offset: (page - 1) * limit })
  if (error) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Audit events could not be loaded'), { status: 500 })
  return NextResponse.json(createApiResponse({ items: data ?? [], page, limit, hasMore: (data?.length ?? 0) === limit }))
}
