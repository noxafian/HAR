/** POST /api/v1/library/upload — direct file upload to Supabase Storage. */
import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireApprovedMember } from '@/lib/server/auth'
import { createServiceRoleClient } from '@/lib/server/supabase'
import { uploadFile, getSignedUrl } from '@/lib/server/firebase-storage'
import { validateFileType, validateFileSize, sanitizeFilename, validateFileMagicBytes, type AllowedFileExtension } from '@/security/validator'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { logAuditEvent } from '@/security/audit'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const user = await requireApprovedMember().catch((error: unknown) => {
    const status = (error as { status?: number }).status ?? 401
    return status === 403 ? 'membership-denied' : null
  })
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (user === 'membership-denied') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required'), { status: 403 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid multipart/form-data'), { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'File is required'), { status: 400 })
  }

  const title = formData.get('title')?.toString() || ''
  const description = formData.get('description')?.toString() || null
  const subject = formData.get('subject')?.toString() || undefined
  const topic = formData.get('topic')?.toString() || undefined
  const paper = (formData.get('paper')?.toString() || 'CS') as 'CS' | 'DA' | 'GA'

  if (!title || title.length < 1 || title.length > 255) {
    return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Title is required and must be 1-255 characters'), { status: 400 })
  }

  const fileSize = file.size
  const sizeCheck = validateFileSize(fileSize)
  if (!sizeCheck.valid) return NextResponse.json(createErrorResponse(ErrorCodes.FILE_TOO_LARGE.id, sizeCheck.error ?? 'File too large'), { status: 400 })

  const typeCheck = validateFileType(file.name, file.type)
  if (!typeCheck.valid || !typeCheck.extension) return NextResponse.json(createErrorResponse(ErrorCodes.UNSUPPORTED_FILE_TYPE.id, typeCheck.error ?? 'Unsupported file type'), { status: 400 })

  try {
    // Read file content
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Validate file magic bytes
    if (!validateFileMagicBytes(buffer.subarray(0, 16), typeCheck.extension as AllowedFileExtension)) {
      return NextResponse.json(createErrorResponse(ErrorCodes.UNSUPPORTED_FILE_TYPE.id, 'File signature does not match the declared file type'), { status: 400 })
    }

    // Validate UTF-8 for text files
    if (typeCheck.extension === 'txt') {
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(buffer)
      } catch {
        return NextResponse.json(createErrorResponse(ErrorCodes.UNSUPPORTED_FILE_TYPE.id, 'Text files must be valid UTF-8'), { status: 400 })
      }
    }

    // Compute file hash
    const contentHash = createHash('sha256').update(buffer).digest('hex')

    const db = createServiceRoleClient()
    let subjectId: string | null = null
    let topicId: string | null = null

    if (subject) {
      const { data, error } = await db.from('subjects').select('id').ilike('name', subject).limit(2)
      if (error) throw new Error(`Subject lookup failed: ${error.message}`)
      if (!data || data.length !== 1) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Subject not found or ambiguous'), { status: 400 })
      subjectId = data[0].id
    }
    if (topic) {
      let query = db.from('topics').select('id,subject_id').ilike('name', topic)
      if (subjectId) query = query.eq('subject_id', subjectId)
      const { data, error } = await query.limit(2)
      if (error) throw new Error(`Topic lookup failed: ${error.message}`)
      if (!data || data.length !== 1) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Topic not found or ambiguous'), { status: 400 })
      if (subjectId && data[0].subject_id !== subjectId) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Topic does not belong to the selected subject'), { status: 400 })
      topicId = data[0].id
      subjectId = subjectId ?? data[0].subject_id
    }

    // Check for duplicate by content hash
    const { data: existingResource } = await db.from('resources')
      .select('id')
      .eq('content_hash', contentHash)
      .eq('is_deleted', false)
      .maybeSingle()

    if (existingResource) {
      return NextResponse.json(createApiResponse({
        resourceId: existingResource.id,
        duplicate: true,
        status: 'existing',
      }, 'This file is already in your library'), { status: 200 })
    }

    // Generate storage path
    const timestamp = Date.now()
    const sanitizedName = sanitizeFilename(file.name)
    const objectKey = `library/${timestamp}-${sanitizedName}`
    
    // These are guaranteed to exist after validation above
    const fileExtension = typeCheck.extension as AllowedFileExtension
    const contentType = typeCheck.expectedMime as string

    // Upload to Supabase Storage
    await uploadFile(objectKey, buffer, contentType)

    // Create resource record — auto-verified so all approved members can access immediately
    const { data: resource, error: createError } = await db.from('resources')
      .insert({
        title,
        description,
        file_type: fileExtension,
        file_size: fileSize,
        content_hash: contentHash,
        object_key: objectKey,
        paper,
        subject_id: subjectId,
        topic_id: topicId,
        uploaded_by: user.id,
        status: 'verified',
      })
      .select('id')
      .single()

    if (createError || !resource) {
      throw new Error(createError?.message ?? 'Failed to create resource record')
    }

    // Get download URL
    const downloadUrl = await getSignedUrl(objectKey, 900_000) // 15 minutes

    await logAuditEvent('resource.uploaded', user.id, 'resource', resource.id, {
      metadata: { fileType: fileExtension, fileSize, status: 'verified' },
    })

    return NextResponse.json(createApiResponse({
      resourceId: resource.id,
      downloadUrl,
      status: 'verified',
    }, 'File uploaded successfully'), { status: 201 })
  } catch (error) {
    console.error('Storage upload failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(createErrorResponse(ErrorCodes.SERVICE_UNAVAILABLE.id, 'Upload service is not configured or is temporarily unavailable'), { status: 503 })
  }
}
