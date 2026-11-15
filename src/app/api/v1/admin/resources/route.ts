import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

const statuses = new Set(['pending', 'verified', 'rejected', 'unverified'])
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive || user.role !== 'owner') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  const status = req.nextUrl.searchParams.get('status')
  const search = req.nextUrl.searchParams.get('search')?.trim().slice(0, 100) || null
  if (status && !statuses.has(status)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid resource status'), { status: 400 })
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') || 1) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 30) || 30))
  const db = await createSupabaseClient()
  const [list, count] = await Promise.all([
    db.rpc('admin_list_resources', { p_status: status, p_search: search, p_limit: limit, p_offset: (page - 1) * limit }),
    db.rpc('admin_count_resources', { p_status: status, p_search: search }),
  ])
  if (list.error || count.error) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Resources could not be loaded'), { status: 500 })
  const total = Number(count.data ?? 0)
  return NextResponse.json(createApiResponse({ items: list.data ?? [], total, page, limit, hasMore: page * limit < total }))
}
