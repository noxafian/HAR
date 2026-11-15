/** POST /api/v1/membership/requests/[requestId]/approve — atomic owner RPC. */
import { NextRequest, NextResponse } from 'next/server'
import { ApproveRequestSchema } from '@/schemas/membership.schema'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
export async function POST(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (user.role !== 'owner') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  const { requestId } = await params
  let body: unknown
  try { body = await req.json() } catch { body = {} }
  const parsed = ApproveRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.rpc('approve_join_request', { p_request_id: requestId, p_role: parsed.data.role })
  if (error) {
    const status = error.code === 'P0002' ? 404 : error.code === '55000' ? 409 : error.code === '42501' ? 403 : 500
    return NextResponse.json(createErrorResponse(status === 404 ? ErrorCodes.USER_NOT_FOUND.id : status === 403 ? ErrorCodes.INSUFFICIENT_PERMISSIONS.id : status === 409 ? ErrorCodes.RESOURCE_CONFLICT.id : ErrorCodes.INTERNAL_SERVER_ERROR.id, status === 500 ? 'Approval failed' : error.message), { status })
  }
  return NextResponse.json(createApiResponse(data, 'Member approved'))
}
