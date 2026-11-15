/** Database-backed resource detail, metadata update and soft-delete operations. */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, requireApprovedMember } from '@/lib/server/auth'
import { createServiceRoleClient, createSupabaseClient } from '@/lib/server/supabase'
import { deleteFile } from '@/lib/server/firebase-storage'
import { UpdateResourceSchema } from '@/schemas/library.schema'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { logAuditEvent } from '@/security/audit'

type Ctx = { params: Promise<{ resourceId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const member = await requireApprovedMember().catch(() => null)
  if (!member) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, 'Approved membership required'), { status: 401 })
  const { resourceId } = await params
  const db = await createSupabaseClient()
  const { data, error } = await db.from('resources')
    .select('id,title,description,paper,subject_id,topic_id,file_type,file_size,status,uploaded_by,verified_by,verified_at,version,download_count,created_at,updated_at,subjects(name),topics(name)')
    .eq('id', resourceId).eq('is_deleted', false).maybeSingle()
  if (error) return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Resource could not be loaded'), { status: 500 })
  if (!data) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Resource not found'), { status: 404 })
  return NextResponse.json(createApiResponse(data, 'Resource retrieved'))
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await requireApprovedMember().catch(() => null)
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, 'Approved membership required'), { status: 401 })
  const { resourceId } = await params
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = UpdateResourceSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })

  const admin = createServiceRoleClient()
  const { data: resource, error: lookupError } = await admin.from('resources')
    .select('id,uploaded_by,status,is_deleted').eq('id', resourceId).maybeSingle()
  if (lookupError) return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Resource could not be loaded'), { status: 500 })
  if (!resource || resource.is_deleted) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Resource not found'), { status: 404 })
  const privileged = user.role === 'owner'
  if (!privileged && resource.uploaded_by !== user.id) return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Only the uploader or an owner can edit this resource'), { status: 403 })

  const patch: Record<string, unknown> = {}
  if (parsed.data.title !== undefined) patch.title = parsed.data.title
  if (parsed.data.description !== undefined) patch.description = parsed.data.description
  if (parsed.data.subject !== undefined) {
    const { data, error } = await admin.from('subjects').select('id').ilike('name', parsed.data.subject).limit(2)
    if (error || !data || data.length !== 1) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Subject not found or ambiguous'), { status: 400 })
    patch.subject_id = data[0].id
  }
  if (parsed.data.topic !== undefined) {
    let query = admin.from('topics').select('id,subject_id').ilike('name', parsed.data.topic)
    if (typeof patch.subject_id === 'string') query = query.eq('subject_id', patch.subject_id)
    const { data, error } = await query.limit(2)
    if (error || !data || data.length !== 1) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Topic not found or ambiguous'), { status: 400 })
    if (typeof patch.subject_id === 'string' && data[0].subject_id !== patch.subject_id) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Topic does not belong to the selected subject'), { status: 400 })
    patch.topic_id = data[0].id
    if (patch.subject_id === undefined) patch.subject_id = data[0].subject_id
  }
  if (Object.keys(patch).length === 0) return NextResponse.json(createApiResponse({ resourceId }, 'Resource unchanged'))
  const { data, error } = await admin.from('resources').update(patch).eq('id', resourceId).eq('is_deleted', false)
    .select('id,title,description,subject_id,topic_id,file_type,file_size,status,updated_at').single()
  if (error) return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Resource update failed'), { status: 500 })
  return NextResponse.json(createApiResponse(data, 'Resource updated'))
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (user.role !== 'owner') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  const { resourceId } = await params
  const admin = createServiceRoleClient()
  const { data: resource, error: lookupError } = await admin.from('resources')
    .select('id,object_key,is_deleted').eq('id', resourceId).maybeSingle()
  if (lookupError) return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Resource lookup failed'), { status: 500 })
  if (!resource) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Resource not found'), { status: 404 })
  if (!resource.is_deleted) {
    const { error } = await admin.from('resources').update({ is_deleted: true }).eq('id', resourceId)
    if (error) return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Resource deletion failed'), { status: 500 })
  }
  try {
    await deleteFile(resource.object_key)
  } catch {
    // The row stays soft-deleted. Retrying DELETE is safe and retries object cleanup.
    return NextResponse.json(createErrorResponse(ErrorCodes.SERVICE_UNAVAILABLE.id, 'Resource was hidden but object cleanup failed; retry deletion'), { status: 503 })
  }
  await logAuditEvent('resource.deleted', user.id, 'resource', resourceId)
  return new NextResponse(null, { status: 204 })
}
