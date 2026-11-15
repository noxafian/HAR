import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PatchMockTestSchema = z.object({
  title: z.string().min(1).max(255).trim().optional(),
  duration_minutes: z.number().int().min(1).max(480).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  is_available: z.boolean().optional(),
  mode: z.string().max(50).optional(),
})

async function authGuard() {
  const user = await getAuthenticatedUser()
  if (!user) return { error: NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 }) }
  if (!user.isActive || user.role !== 'owner') {
    return { error: NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 }) }
  }
  return { error: null }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await authGuard()
  if (error) return error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid mock test ID'), { status: 400 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = PatchMockTestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, parsed.error.issues[0]?.message ?? 'Validation failed'), { status: 400 })
  }
  const updatePayload: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() }
  if (parsed.data.status === 'published') {
    updatePayload.published_at = new Date().toISOString()
  }
  const db = await createSupabaseClient()
  if (parsed.data.is_available === true) {
    const { data: existing } = await db.from('mock_tests').select('status').eq('id', id).maybeSingle()
    if (!existing || existing.status !== 'published') {
      return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_CONFLICT.id, 'Test must be published before making it available'), { status: 409 })
    }
  }
  const { data, error: dbError } = await db.from('mock_tests').update(updatePayload).eq('id', id).select('id,title,paper,duration_minutes,total_questions,total_marks,status,is_available,mode,created_at,updated_at').maybeSingle()
  if (dbError) {
    console.error('[admin.mock-tests.patch]', dbError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not update mock test'), { status: 500 })
  }
  if (!data) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Mock test not found'), { status: 404 })
  return NextResponse.json(createApiResponse(data, 'Mock test updated'))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await authGuard()
  if (error) return error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid mock test ID'), { status: 400 })
  const db = await createSupabaseClient()
  const { data: existing } = await db.from('mock_tests').select('status').eq('id', id).maybeSingle()
  if (!existing) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Mock test not found'), { status: 404 })
  if (existing.status === 'published') {
    return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_CONFLICT.id, 'Unpublish the test before deleting'), { status: 409 })
  }
  const { error: dbError } = await db.from('mock_tests').delete().eq('id', id)
  if (dbError) {
    console.error('[admin.mock-tests.delete]', dbError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not delete mock test'), { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
