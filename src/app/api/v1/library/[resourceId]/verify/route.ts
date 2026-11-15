/** POST /api/v1/library/[resourceId]/verify — owner resource review. */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { logAuditEvent } from '@/security/audit'
import { z } from 'zod'

const ModerationSchema = z.object({ status: z.enum(['verified', 'rejected']) })
export async function POST(req: NextRequest, { params }: { params: Promise<{ resourceId: string }> }) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive || user.role !== 'owner') {
    return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  }
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON body'), { status: 400 }) }
  const parsed = ModerationSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Status must be verified or rejected'), { status: 400 })
  const { resourceId } = await params
  const db = await createSupabaseClient()
  const { data, error } = await db.rpc('moderate_resource', { p_resource_id: resourceId, p_status: parsed.data.status })
  if (error) {
    const status = error.code === 'P0002' ? 404 : error.code === '42501' ? 403 : 409
    return NextResponse.json(createErrorResponse(status === 404 ? ErrorCodes.RESOURCE_NOT_FOUND.id : status === 403 ? ErrorCodes.INSUFFICIENT_PERMISSIONS.id : ErrorCodes.RESOURCE_CONFLICT.id, error.message), { status })
  }
  await logAuditEvent('resource.moderated', user.id, 'resource', resourceId, { metadata: { moderationStatus: parsed.data.status } })
  return NextResponse.json(createApiResponse(data, 'Resource moderation updated'))
}
