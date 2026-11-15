/** GET /api/v1/membership/status — current account state from PostgreSQL. */
import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
export async function GET() {
  const supabase = await createSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  const [{ data: membership, error }, { data: request }] = await Promise.all([
    supabase.from('memberships').select('status,role,joined_at,approved_at,rejected_at,rejection_reason,suspended_at,suspension_reason').eq('user_id', user.id).maybeSingle(),
    supabase.from('join_requests').select('id,status,requested_at,message').eq('user_id', user.id).order('requested_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (error) return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Membership status could not be loaded'), { status: 500 })
  return NextResponse.json(createApiResponse({
    status: membership?.status ?? 'none', role: membership?.role ?? 'member',
    requestedAt: request?.requested_at ?? null, requestStatus: request?.status ?? null,
    joinRequestId: request?.id ?? null, message: request?.message ?? null,
    approvedAt: membership?.approved_at ?? null, rejectedAt: membership?.rejected_at ?? null,
    rejectionReason: membership?.rejection_reason ?? null, suspendedAt: membership?.suspended_at ?? null,
    suspensionReason: membership?.suspension_reason ?? null,
  }))
}
