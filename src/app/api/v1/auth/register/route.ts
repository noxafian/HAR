/**
 * POST /api/v1/auth/register
 * Register a new user. Creates Supabase Auth account + profile row.
 * After registration, the user's membership is PENDING until an owner approves.
 * Exception: if the email and password match ADMIN_EMAIL/ADMIN_PASSWORD env vars,
 * the account is immediately promoted to owner without any approval step.
 */
import { NextRequest, NextResponse } from 'next/server'
import { RegisterRequestSchema } from '@/schemas/auth.schema'
import { createSupabaseClient, createServiceRoleClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { logAuditEvent } from '@/security/audit'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Request body must be valid JSON'),
      { status: 400 }
    )
  }

  const parsed = RegisterRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'),
      { status: 400 }
    )
  }

  const { email, password, displayName, examPapers } = parsed.data

  // Check if this is the configured admin account
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const adminPassword = process.env.ADMIN_PASSWORD
  const isAdminAccount =
    adminEmail &&
    adminPassword &&
    email.toLowerCase() === adminEmail &&
    password === adminPassword

  const supabase = await createSupabaseClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        exam_papers: examPapers,
        join_message: parsed.data.joinMessage ?? null,
      },
    },
  })

  if (error) {
    if (error.message?.toLowerCase().includes('already registered')) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.DUPLICATE_EMAIL.id, ErrorCodes.DUPLICATE_EMAIL.message),
        { status: 409 }
      )
    }
    console.error('[auth.register] Supabase error:', error.message)
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, ErrorCodes.INTERNAL_SERVER_ERROR.message),
      { status: 500 }
    )
  }

  if (!data.user) {
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'User creation failed'),
      { status: 500 }
    )
  }

  // Auto-promote admin account to owner immediately
  if (isAdminAccount) {
    try {
      const admin = createServiceRoleClient()

      // Check no owner already exists (safety guard)
      const { data: existingOwners } = await admin
        .from('memberships')
        .select('user_id')
        .eq('role', 'owner')
        .limit(1)

      if (!existingOwners || existingOwners.length === 0) {
        await admin
          .from('memberships')
          .update({ role: 'owner', status: 'approved' })
          .eq('user_id', data.user.id)

        // Also confirm the email server-side so no email confirmation is needed
        await admin.auth.admin.updateUserById(data.user.id, {
          email_confirm: true,
        })

        await logAuditEvent('admin.owner_bootstrapped', data.user.id, 'membership', data.user.id, {
          status: 'success',
          metadata: { method: 'admin_env_credentials' },
        })

        return NextResponse.json(
          createApiResponse(
            {
              user: {
                id: data.user.id,
                email: data.user.email,
                displayName,
                membershipStatus: 'approved',
                role: 'owner',
                sessionReady: Boolean(data.session),
              },
            },
            'Admin account created and approved. You can sign in now.'
          ),
          { status: 201 }
        )
      }
    } catch (adminError) {
      console.error('[auth.register] Admin auto-promote failed:', adminError instanceof Error ? adminError.message : adminError)
      // Fall through to normal pending registration
    }
  }

  await logAuditEvent('auth.register', data.user.id, 'user', data.user.id, {
    status: 'success',
    metadata: { email: data.user.email },
  })

  return NextResponse.json(
    createApiResponse(
      {
        user: {
          id: data.user.id,
          email: data.user.email,
          displayName,
          membershipStatus: 'pending',
          role: 'member',
          sessionReady: Boolean(data.session),
        },
      },
      'Registration successful. Your access request is pending approval.'
    ),
    { status: 201 }
  )
}

