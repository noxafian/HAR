/**
 * GET  /api/v1/users/profile  — retrieve own profile
 * PATCH /api/v1/users/profile — update own profile
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { UpdateProfileSchema } from '@/schemas/profile.schema'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message),
      { status: 401 }
    )
  }
  return NextResponse.json(createApiResponse(user, 'Profile retrieved'))
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message),
      { status: 401 }
    )
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON body'),
      { status: 400 }
    )
  }

  const parsed = UpdateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'),
      { status: 400 }
    )
  }

  const supabase = await createSupabaseClient()
  const update: Record<string, unknown> = {}
  if (parsed.data.displayName !== undefined) update.display_name = parsed.data.displayName
  if (parsed.data.avatarUrl !== undefined) update.avatar_url = parsed.data.avatarUrl
  if (parsed.data.examPapers !== undefined) update.exam_papers = parsed.data.examPapers
  if (Object.keys(update).length === 0) {
    return NextResponse.json(createApiResponse(user, 'Profile unchanged'))
  }
  const { error } = await supabase.from('user_profiles').update(update).eq('id', user.id)
  if (error) {
    console.error('[users.profile.patch]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Profile update failed'), { status: 500 })
  }
  const updated = await getAuthenticatedUser()
  return NextResponse.json(createApiResponse(updated, 'Profile updated'))
}
