/** GET /api/v1/library/[resourceId]/download — issue a short-lived Supabase Storage download URL. */
import { NextResponse } from 'next/server'
import { requireApprovedMember } from '@/lib/server/auth'
import { createServiceRoleClient, createSupabaseClient } from '@/lib/server/supabase'
import { getSignedUrl } from '@/lib/server/firebase-storage'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { logAuditEvent } from '@/security/audit'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const user = await requireApprovedMember().catch((error: unknown) => {
    const status = (error as { status?: number }).status ?? 401
    return status === 403 ? 'membership-denied' : null
  })
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (user === 'membership-denied') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required'), { status: 403 })

  const { resourceId } = await params
  const db = createServiceRoleClient()
  const { data: resource, error } = await db.from('resources')
    .select('id,object_key,status,uploaded_by,is_deleted,file_type,title').eq('id', resourceId).maybeSingle()
  if (error) return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Resource could not be loaded'), { status: 500 })
  if (!resource || resource.is_deleted || resource.status !== 'verified') {
    return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Resource not found'), { status: 404 })
  }
  try {
    const downloadUrl = await getSignedUrl(resource.object_key, 900_000) // 15 minutes
    const userClient = await createSupabaseClient()
    const { error: countError } = await userClient.rpc('increment_resource_download', { p_resource_id: resourceId })
    if (countError) console.error('[library.download.count]', countError.message)
    await logAuditEvent('resource.downloaded', user.id, 'resource', resourceId, { metadata: { fileType: resource.file_type } })
    return NextResponse.json(createApiResponse({ resourceId, title: resource.title, downloadUrl, expiresIn: 900 }, 'Download URL created'))
  } catch (err) {
    console.error('[library.download]', err instanceof Error ? err.message : 'Supabase Storage signing failed')
    return NextResponse.json(createErrorResponse(ErrorCodes.SERVICE_UNAVAILABLE.id, 'Download service is unavailable'), { status: 503 })
  }
}
