/**
 * POST /api/v1/auth/refresh
 * Refresh the current user's session token and renew auth cookies.
 * Returns 401 if no valid session or refresh token exists.
 */
import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/server/supabase'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

export async function POST() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, 'No active session to refresh'),
      { status: 401 }
    )
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.auth.refreshSession()

  if (error || !data.session) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, 'Session refresh failed or token expired'),
      { status: 401 }
    )
  }

  return NextResponse.json(
    createApiResponse(
      {
        user,
        expiresAt: data.session.expires_at
          ? new Date(data.session.expires_at * 1000).toISOString()
          : null,
      },
      'Session successfully refreshed'
    )
  )
}

