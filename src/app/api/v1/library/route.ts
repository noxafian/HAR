/** GET /api/v1/library — database-backed resource search and pagination. */
import { NextRequest, NextResponse } from 'next/server'
import { requireApprovedMember } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { ListResourcesQuerySchema } from '@/schemas/library.schema'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

export async function GET(req: NextRequest) {
  const user = await requireApprovedMember().catch((error: unknown) => {
    const status = (error as { status?: number }).status ?? 401
    return status === 403 ? 'membership-denied' : null
  })
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (user === 'membership-denied') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required'), { status: 403 })

  const parsed = ListResourcesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Invalid query parameters'), { status: 400 })
  const { search, subject, paper, type, category, limit, offset } = parsed.data
  const db = await createSupabaseClient()
  let subjectId: string | null = null
  if (subject) {
    const { data, error } = await db.from('subjects').select('id').ilike('name', subject).limit(2)
    if (error) return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Subject filter could not be resolved'), { status: 500 })
    if (!data || data.length !== 1) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Subject not found or ambiguous'), { status: 400 })
    subjectId = data[0].id
  }

  let query = db.from('resources')
    .select('id,title,description,paper,subject_id,topic_id,file_type,file_size,status,uploaded_by,verified_by,verified_at,version,download_count,created_at,updated_at,category', { count: 'exact' })
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (search) query = query.or(`title.ilike.%${search.replace(/[%,()]/g, ' ')}%,description.ilike.%${search.replace(/[%,()]/g, ' ')}%`)
  if (subjectId) query = query.eq('subject_id', subjectId)
  if (paper) query = query.eq('paper', paper)
  if (type) query = query.eq('file_type', type)
  if (category) query = query.eq('category', category)
  const { data, error, count } = await query
  if (error) {
    console.error('[library.list]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Resources could not be loaded'), { status: 500 })
  }
  const total = count ?? 0
  return NextResponse.json(createApiResponse({ items: data ?? [], total, limit, offset, hasMore: offset + limit < total }, 'Resources retrieved'))
}
