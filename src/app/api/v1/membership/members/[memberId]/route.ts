/** PATCH /api/v1/membership/members/[memberId] — owner-only database operation. */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { UpdateMemberSchema } from '@/schemas/membership.schema'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (user.role !== 'owner') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  const { memberId } = await params
  if (memberId === user.id) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_CONFLICT.id, 'Cannot modify your own account via this endpoint'), { status: 409 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON body'), { status: 400 }) }
  const parsed = UpdateMemberSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })
  const supabase = await createSupabaseClient()
  const results = []
  if (parsed.data.role) {
    const { data, error } = await supabase.rpc('set_member_role', { p_user_id: memberId, p_role: parsed.data.role })
    if (error) return NextResponse.json(createErrorResponse(error.code === 'P0002' ? ErrorCodes.USER_NOT_FOUND.id : ErrorCodes.INTERNAL_SERVER_ERROR.id, error.message), { status: error.code === 'P0002' ? 404 : 500 })
    results.push(data)
  }
  if (parsed.data.action) {
    const status = parsed.data.action === 'suspend' ? 'suspended' : parsed.data.action === 'remove' ? 'removed' : 'approved'
    const { data, error } = await supabase.rpc('set_member_access', { p_user_id: memberId, p_status: status, p_reason: parsed.data.reason ?? null })
    if (error) return NextResponse.json(createErrorResponse(error.code === 'P0002' ? ErrorCodes.USER_NOT_FOUND.id : ErrorCodes.INTERNAL_SERVER_ERROR.id, error.message), { status: error.code === 'P0002' ? 404 : 500 })
    results.push(data)
  }
  return NextResponse.json(createApiResponse({ userId: memberId, changes: results }, 'Member updated'))
}
