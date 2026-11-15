/** Secure first-owner bootstrap. All authority is written to memberships, not Auth metadata. */
import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { BootstrapOwnerRequestSchema } from '@/schemas/auth.schema'
import { createServiceRoleClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { logAuditEvent } from '@/security/audit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const configuredSecret = process.env.ADMIN_BOOTSTRAP_SECRET
  if (!configuredSecret || configuredSecret.length < 32) {
    return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id,
      'Owner bootstrapping is disabled. Configure a 32-character high-entropy ADMIN_BOOTSTRAP_SECRET.'), { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Request body must be valid JSON'), { status: 400 })
  }
  const parsed = BootstrapOwnerRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })

  const submitted = createHash('sha256').update(parsed.data.bootstrapSecret).digest()
  const expected = createHash('sha256').update(configuredSecret).digest()
  if (!timingSafeEqual(submitted, expected)) {
    return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Invalid bootstrap secret'), { status: 403 })
  }

  try {
    const admin = createServiceRoleClient()
    const { data: owners, error: ownerError } = await admin.from('memberships').select('user_id').eq('role', 'owner').limit(1)
    if (ownerError) throw ownerError
    if (owners && owners.length > 0) {
      return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_CONFLICT.id, 'An owner account already exists; bootstrap is permanently locked'), { status: 409 })
    }

    // Supabase Auth Admin listUsers is paginated; scan in bounded pages rather than
    // assuming the target appears in the first 50 accounts.
    let targetUser: { id: string; email?: string } | null = null
    for (let page = 1; page <= 20 && !targetUser; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw error
      targetUser = data.users.find(user => user.email?.toLowerCase() === parsed.data.email.toLowerCase()) ?? null
      if (data.users.length < 1000) break
    }
    if (!targetUser) return NextResponse.json(createErrorResponse(ErrorCodes.USER_NOT_FOUND.id, 'Register the target account before bootstrapping'), { status: 404 })

    // Idempotent seed function supports retry when the secret was stored but the
    // owner-promotion transaction did not complete.
    const { error: seedError } = await admin.rpc('seed_owner_bootstrap_secret', { p_secret: configuredSecret })
    if (seedError && seedError.code !== '55000') throw seedError
    const { error: bootstrapError } = await admin.rpc('bootstrap_owner_pub', {
      p_user_id: targetUser.id,
      p_secret: parsed.data.bootstrapSecret,
    })
    if (bootstrapError) {
      const status = bootstrapError.code === 'P0040' || bootstrapError.code === 'P0044' ? 409
        : bootstrapError.code === 'P0042' ? 403 : bootstrapError.code === 'P0043' || bootstrapError.code === 'P0045' ? 404 : 500
      return NextResponse.json(createErrorResponse(status === 409 ? ErrorCodes.RESOURCE_CONFLICT.id : status === 403 ? ErrorCodes.INSUFFICIENT_PERMISSIONS.id : status === 404 ? ErrorCodes.USER_NOT_FOUND.id : ErrorCodes.INTERNAL_SERVER_ERROR.id,
        status === 500 ? 'Owner bootstrap failed' : bootstrapError.message), { status })
    }
    await logAuditEvent('admin.owner_bootstrapped', targetUser.id, 'membership', targetUser.id, { status: 'success' })
    return NextResponse.json(createApiResponse({ userId: targetUser.id, email: targetUser.email, role: 'owner', membershipStatus: 'approved' }, 'Initial owner account successfully bootstrapped'))
  } catch (error) {
    console.error('[admin.bootstrap]', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Owner bootstrap service is unavailable'), { status: 500 })
  }
}
