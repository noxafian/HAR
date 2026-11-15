/** GET /api/v1/membership/members — owner-only membership directory. */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (user.role !== 'owner') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? 1) || 1)
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 50) || 50))
  const statusParam = req.nextUrl.searchParams.get('status')
  const allowed = ['pending','approved','rejected','suspended','removed']
  if (statusParam && !allowed.includes(statusParam)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid membership status'), { status: 400 })
  const supabase = await createSupabaseClient()
  const [{ data, error }, { data: totalCount, error: countError }] = await Promise.all([
    supabase.rpc('list_members', { p_status: statusParam ?? null, p_limit: limit, p_offset: (page - 1) * limit }),
    supabase.rpc('count_members', { p_status: statusParam ?? null }),
  ])
  if (error || countError) return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Members could not be loaded'), { status: 500 })
  const items = data ?? []
  const total = Number(totalCount ?? items.length)
  return NextResponse.json(createApiResponse({ items, total, page, limit, hasMore: page * limit < total }))
}
