/**
 * POST /api/v1/auth/logout
 * Terminate the current session.
 */
import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/server/supabase'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { logAuditEvent } from '@/security/audit'

export async function POST() {
  const user = await getAuthenticatedUser()
  const supabase = await createSupabaseClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Logout failed'),
      { status: 500 }
    )
  }

  if (user) {
    await logAuditEvent('auth.logout', user.id, 'user', user.id, { status: 'success' })
  }

  return NextResponse.json(createApiResponse(null, 'Logged out successfully'))
}
