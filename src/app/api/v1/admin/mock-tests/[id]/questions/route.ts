import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const AttachSchema = z.object({
  question_ids: z.array(z.string().uuid()).min(1).max(200),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive || user.role !== 'owner') {
    return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  }
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid mock test ID'), { status: 400 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = AttachSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, parsed.error.issues[0]?.message ?? 'Validation failed'), { status: 400 })
  }
  const db = await createSupabaseClient()
  // Delete all existing attachments for this mock test
  const { error: deleteError } = await db.from('mock_test_questions').delete().eq('mock_test_id', id)
  if (deleteError) {
    console.error('[admin.mock-tests.questions.post] delete existing', deleteError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not replace question list'), { status: 500 })
  }
  // Insert new attachments with display_order
  const rows = parsed.data.question_ids.map((question_id, index) => ({
    mock_test_id: id,
    question_id,
    display_order: index,
  }))
  const { error: insertError } = await db.from('mock_test_questions').insert(rows)
  if (insertError) {
    console.error('[admin.mock-tests.questions.post] insert', insertError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not attach questions'), { status: 500 })
  }
  // Update total_questions on the mock test
  await db.from('mock_tests').update({ total_questions: parsed.data.question_ids.length }).eq('id', id)
  return NextResponse.json(createApiResponse({ attached: parsed.data.question_ids.length }, 'Questions attached'))
}
