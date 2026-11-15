import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

type Ctx = { params: Promise<{ questionId: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ModerateQuestionSchema = z.object({
  action: z.enum(['verify', 'reject']),
  solution: z.string().max(5000).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string()), z.number()]).optional(),
  natTolerance: z.number().min(0).optional(),
})

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  const { questionId } = await params
  if (!UUID.test(questionId)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid question ID'), { status: 400 })
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from('questions').select('id,type,category,section,year,subject_id,topic_id,prompt,options,marks,difficulty,source_ref,is_verified,submitted_by,created_at,updated_at').eq('id', questionId).eq('is_deleted', false).eq('is_verified', true).maybeSingle()
  if (error) {
    console.error('[questions.detail]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve question'), { status: 500 })
  }
  if (!data) return NextResponse.json(createErrorResponse(ErrorCodes.QUESTION_NOT_FOUND.id, 'Question not found'), { status: 404 })
  let solution: string | null = null
  let officialAnswer: string | string[] | number | null = null
  if (data.category === 'official-pyq' || user.role === 'owner') {
    const { data: keyData, error: solutionError } = await supabase.rpc('get_question_solution', { p_question_id: questionId })
    if (solutionError) {
      console.error('[questions.solution]', solutionError.message)
      return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Question solution could not be retrieved'), { status: 500 })
    }
    const payload = keyData as { correctAnswer?: string | string[] | number | null; solution?: string | null } | null
    solution = payload?.solution ?? null
    officialAnswer = payload?.correctAnswer ?? null
  }
  return NextResponse.json(createApiResponse({ ...data, solution, officialAnswer }, 'Question retrieved'))
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (user.role !== 'owner') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  const { questionId: questionIdPatch } = await params
  if (!UUID.test(questionIdPatch)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid question ID'), { status: 400 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = ModerateQuestionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Invalid moderation request'), { status: 400 })
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.rpc('moderate_question', {
    p_question_id: questionIdPatch, p_action: parsed.data.action,
    p_solution: parsed.data.solution ?? null,
    p_correct_answer: parsed.data.correctAnswer === undefined ? null : parsed.data.correctAnswer,
    p_nat_tolerance: parsed.data.natTolerance ?? null,
  })
  if (error) {
    if (error.code === 'P0002') return NextResponse.json(createErrorResponse(ErrorCodes.QUESTION_NOT_FOUND.id, 'Question not found'), { status: 404 })
    if (error.code === '42501') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
    if (error.code === '23514') return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'A verified question requires a correct answer key'), { status: 400 })
    console.error('[questions.moderate]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not moderate question'), { status: 500 })
  }
  return NextResponse.json(createApiResponse({ id: data, status: parsed.data.action === 'verify' ? 'verified' : 'rejected' }, 'Question moderation completed'))
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (user.role !== 'owner') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  const { questionId } = await params
  if (!UUID.test(questionId)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid question ID'), { status: 400 })
  const supabase = await createSupabaseClient()
  const { error } = await supabase.rpc('moderate_question', { p_question_id: questionId, p_action: 'delete', p_solution: null, p_correct_answer: null, p_nat_tolerance: null })
  if (error) {
    if (error.code === 'P0002') return NextResponse.json(createErrorResponse(ErrorCodes.QUESTION_NOT_FOUND.id, 'Question not found'), { status: 404 })
    console.error('[questions.delete]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not delete question'), { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
