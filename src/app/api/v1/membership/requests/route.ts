/** GET /api/v1/membership/requests — owner-only, database-backed queue. */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (user.role !== 'owner') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? 1) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 20) || 20))
  const supabase = await createSupabaseClient()
  const [{ data, error }, { data: totalCount, error: countError }] = await Promise.all([
    supabase.rpc('list_pending_join_requests', { p_limit: limit, p_offset: (page - 1) * limit }),
    supabase.rpc('count_pending_join_requests'),
  ])
  if (error || countError) return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Join requests could not be loaded'), { status: 500 })
  const items = data ?? []
  const total = Number(totalCount ?? items.length)
  return NextResponse.json(createApiResponse({ items, total, page, limit, hasMore: page * limit < total }))
}
