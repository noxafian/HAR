/**
 * Authentication resolves identity from Supabase Auth and authorization from
 * the canonical PostgreSQL memberships table. JWT/user_metadata roles are never trusted.
 */
import { createSupabaseClient, getUserSession } from './supabase'
import type { UserProfile, UserRole } from '@/types/user'

export async function getAuthenticatedUser(): Promise<UserProfile | null> {
  try {
    const supabase = await createSupabaseClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) return null

    const userId = authData.user.id
    const [profileResult, membershipResult] = await Promise.all([
      supabase.from('user_profiles')
        .select('id,email,display_name,avatar_url,exam_papers,created_at')
        .eq('id', userId).maybeSingle(),
      supabase.from('memberships')
        .select('role,status,joined_at,created_at')
        .eq('user_id', userId).maybeSingle(),
    ])

    if (profileResult.error || membershipResult.error || !profileResult.data || !membershipResult.data) {
      // Log the actual failure reason server-side without exposing it to the client
      if (profileResult.error) console.error('[auth.getUser] profile query error:', profileResult.error.message)
      if (membershipResult.error) console.error('[auth.getUser] membership query error:', membershipResult.error.message)
      if (!profileResult.data) console.error('[auth.getUser] no profile row for user:', userId)
      if (!membershipResult.data) console.error('[auth.getUser] no membership row for user:', userId)
      return null
    }

    const profile = profileResult.data
    const membership = membershipResult.data
    const role = membership.role as UserRole
    if (!['owner', 'member'].includes(role)) return null

    // Owner is always treated as active regardless of membership status
    const isActive = role === 'owner' ? true : membership.status === 'approved'

    return {
      id: userId,
      email: profile.email || authData.user.email || '',
      displayName: profile.display_name,
      role,
      avatarUrl: profile.avatar_url,
      examPapers: (profile.exam_papers ?? ['CS']) as ('CS' | 'DA')[],
      joinedAt: membership.joined_at ? new Date(membership.joined_at) : new Date(profile.created_at),
      isActive,
      membershipStatus: membership.status as UserProfile['membershipStatus'],
    }
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<UserProfile> {
  const user = await getAuthenticatedUser()
  if (!user) {
    const error = new Error('Unauthenticated') as Error & { status?: number; code?: string }
    error.status = 401
    error.code = 'UNAUTHENTICATED'
    throw error
  }
  return user
}

export async function requireApprovedMember(): Promise<UserProfile> {
  const user = await requireAuth()
  if (!user.isActive) {
    const error = new Error('Approved membership required') as Error & { status?: number; code?: string }
    error.status = 403
    error.code = 'MEMBERSHIP_REQUIRED'
    throw error
  }
  return user
}

export async function validateSessionToken(token: string): Promise<boolean> {
  if (!token || token.length < 20) return false
  try {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase.auth.getUser(token)
    return !error && Boolean(data.user)
  } catch {
    return false
  }
}

export async function getSessionData() {
  const session = await getUserSession()
  if (!session) return null
  return {
    userId: session.user.id,
    email: session.user.email,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
    accessToken: session.access_token,
  }
}
