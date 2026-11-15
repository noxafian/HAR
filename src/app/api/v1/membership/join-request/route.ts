/** POST /api/v1/membership/join-request */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { JoinRequestSchema } from '@/schemas/membership.schema'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { logAuditEvent } from '@/security/audit'
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON body'), { status: 400 }) }
  const parsed = JoinRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.rpc('submit_join_request', { p_message: parsed.data.message ?? null })
  if (error) {
    if (error.code === 'P0003') return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_CONFLICT.id, error.message), { status: 409 })
    console.error('[membership.join-request]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Join request could not be submitted'), { status: 500 })
  }
  const result = Array.isArray(data) ? data[0] : data
  await logAuditEvent('member.join_request', user.id, 'join_request', result?.request_id ?? user.id, { status: 'success' })
  return NextResponse.json(createApiResponse({ requestId: result?.request_id, status: result?.request_status ?? 'pending' }, 'Join request submitted'), { status: 201 })
}
