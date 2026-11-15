/** GET/PATCH /api/v1/users/privacy-settings */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { UpdatePrivacySettingsSchema } from '@/schemas/profile.schema'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

const DEFAULTS = { profilePublic: false, showStudyStats: false, allowMessages: true, showAnalytics: false }
const COLUMNS = 'profile_public,show_study_stats,allow_messages,show_analytics'
function toApiSettings(row: Record<string, unknown>) {
  return {
    profilePublic: Boolean(row.profile_public),
    showStudyStats: Boolean(row.show_study_stats),
    allowMessages: Boolean(row.allow_messages),
    showAnalytics: Boolean(row.show_analytics),
  }
}

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from('user_profiles').select(COLUMNS).eq('id', user.id).single()
  if (error || !data) return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Privacy settings could not be loaded'), { status: 500 })
  return NextResponse.json(createApiResponse(toApiSettings(data), 'Privacy settings retrieved'))
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = UpdatePrivacySettingsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })

  const update: Record<string, unknown> = {}
  if (parsed.data.profilePublic !== undefined) update.profile_public = parsed.data.profilePublic
  if (parsed.data.showStudyStats !== undefined) update.show_study_stats = parsed.data.showStudyStats
  if (parsed.data.allowMessages !== undefined) update.allow_messages = parsed.data.allowMessages
  if (parsed.data.showAnalytics !== undefined) update.show_analytics = parsed.data.showAnalytics
  const supabase = await createSupabaseClient()
  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from('user_profiles').update(update).eq('id', user.id)
    if (error) return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Privacy settings update failed'), { status: 500 })
  }
  const { data, error } = await supabase.from('user_profiles').select(COLUMNS).eq('id', user.id).single()
  if (error || !data) return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Privacy settings could not be loaded'), { status: 500 })
  return NextResponse.json(createApiResponse(toApiSettings(data), 'Privacy settings updated'))
}
