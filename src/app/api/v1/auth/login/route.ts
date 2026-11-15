/** POST /api/v1/auth/login — authenticate and resolve canonical membership.
 *  If ADMIN_EMAIL/ADMIN_PASSWORD env vars are set and the submitted credentials
 *  match, the account is auto-created and promoted to owner on first login —
 *  no prior registration required.
 */
import { NextRequest, NextResponse } from 'next/server'
import { LoginRequestSchema } from '@/schemas/auth.schema'
import { createSupabaseClient, createServiceRoleClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { logAuditEvent } from '@/security/audit'

async function ensureAdminAccount(email: string, password: string): Promise<void> {
  const admin = createServiceRoleClient()

  // Find or create the auth user
  let userId: string | null = null
  for (let page = 1; page <= 5 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const found = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (found) { userId = found.id; break }
    if (data.users.length < 1000) break
  }

  if (!userId) {
    // Create the account for the first time
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: 'Admin', exam_papers: ['CS', 'DA'] },
    })
    if (createError) throw createError
    userId = created.user.id
  } else {
    // Ensure email is confirmed and password is current
    await admin.auth.admin.updateUserById(userId, { password, email_confirm: true })
  }

  // Check if already an owner
  const { data: existing } = await admin
    .from('memberships')
    .select('role, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (!existing) {
    // Profile/membership may not exist yet if the signup trigger hasn't run —
    // insert them directly via service role.
    await admin.from('user_profiles').upsert({
      id: userId,
      email: email.toLowerCase(),
      display_name: 'Admin',
      exam_papers: ['CS', 'DA'],
    }, { onConflict: 'id' })
    await admin.from('memberships').insert({
      user_id: userId,
      role: 'owner',
      status: 'approved',
      joined_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
    })
  } else if (existing.role !== 'owner' || existing.status !== 'approved') {
    await admin
      .from('memberships')
      .update({ role: 'owner', status: 'approved', joined_at: new Date().toISOString(), approved_at: new Date().toISOString() })
      .eq('user_id', userId)
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Request body must be valid JSON'), { status: 400 })
  }
  const parsed = LoginRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Invalid email or password format'), { status: 400 })
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const adminPassword = process.env.ADMIN_PASSWORD
  const isAdminLogin =
    adminEmail &&
    adminPassword &&
    parsed.data.email.toLowerCase() === adminEmail &&
    parsed.data.password === adminPassword

  // Auto-provision admin account if this is the admin logging in
  if (isAdminLogin) {
    try {
      await ensureAdminAccount(parsed.data.email, parsed.data.password)
    } catch (err) {
      console.error('[auth.login] Admin auto-provision failed:', err instanceof Error ? err.message : err)
      return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Admin account setup failed'), { status: 500 })
    }
  }

  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error || !data.user || !data.session) {
    return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_CREDENTIALS.id, 'Invalid email or password'), { status: 401 })
  }

  const [{ data: profile, error: profileError }, { data: membership, error: membershipError }] = await Promise.all([
    supabase.from('user_profiles').select('display_name,exam_papers').eq('id', data.user.id).maybeSingle(),
    supabase.from('memberships').select('role,status').eq('user_id', data.user.id).maybeSingle(),
  ])
  if (profileError || membershipError || !profile || !membership) {
    await supabase.auth.signOut()
    return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Account provisioning is incomplete'), { status: 500 })
  }
  if (membership.status === 'suspended') {
    await supabase.auth.signOut()
    return NextResponse.json(createErrorResponse(ErrorCodes.MEMBERSHIP_SUSPENDED.id, ErrorCodes.MEMBERSHIP_SUSPENDED.message), { status: 403 })
  }

  await logAuditEvent('auth.login', data.user.id, 'user', data.user.id, { status: 'success', metadata: { membershipStatus: membership.status } })
  return NextResponse.json(createApiResponse({
    user: {
      id: data.user.id,
      email: data.user.email,
      displayName: profile.display_name,
      role: membership.role,
      examPapers: profile.exam_papers,
      membershipStatus: membership.status,
    },
    expiresAt: data.session.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : null,
  }, 'Login successful'))
}
