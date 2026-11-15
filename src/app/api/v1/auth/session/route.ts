/**
 * GET /api/v1/auth/session
 * Returns the current authenticated user's session and profile.
 * Returns 401 if not authenticated.
 */
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { getUserSession } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

export async function GET() {
  const [user, session] = await Promise.all([
    getAuthenticatedUser(),
    getUserSession(),
  ])

  if (!user || !session) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message),
      { status: 401 }
    )
  }

  return NextResponse.json(
    createApiResponse(
      {
        user,
        expiresAt: session.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : null,
      },
      'Session active'
    )
  )
}
