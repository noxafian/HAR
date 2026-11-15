import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PatchQuestionSchema = z.object({
  is_verified: z.boolean().optional(),
  explanation: z.string().max(5000).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  source_ref: z.string().max(500).optional(),
  prompt: z.string().min(1).max(20000).trim().optional(),
  marks: z.union([z.literal(1), z.literal(2)]).optional(),
  year: z.number().int().min(2000).max(2040).optional(),
})

async function authGuard() {
  const user = await getAuthenticatedUser()
  if (!user) return { error: NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 }), user: null }
  if (!user.isActive || user.role !== 'owner') {
    return { error: NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 }), user: null }
  }
  return { error: null, user }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await authGuard()
  if (error) return error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid question ID'), { status: 400 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = PatchQuestionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, parsed.error.issues[0]?.message ?? 'Validation failed'), { status: 400 })
  }
  const db = await createSupabaseClient()
  const { data, error: dbError } = await db.from('questions').update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', id).eq('is_deleted', false).select('id,type,category,section,year,subject_id,topic_id,prompt,options,marks,difficulty,source_ref,is_verified,explanation,created_at,updated_at').maybeSingle()
  if (dbError) {
    console.error('[admin.questions.patch]', dbError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not update question'), { status: 500 })
  }
  if (!data) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Question not found'), { status: 404 })
  return NextResponse.json(createApiResponse(data, 'Question updated'))
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await authGuard()
  if (error) return error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid question ID'), { status: 400 })
  const db = await createSupabaseClient()
  const { error: dbError, count } = await db.from('questions').update({ is_deleted: true, updated_at: new Date().toISOString() }, { count: 'exact' }).eq('id', id).eq('is_deleted', false)
  if (dbError) {
    console.error('[admin.questions.delete]', dbError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not delete question'), { status: 500 })
  }
  if (count === 0) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Question not found'), { status: 404 })
  return new NextResponse(null, { status: 204 })
}
