/** GET/PATCH /api/v1/users/exam-papers */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
const UpdateExamPapersSchema = z.object({ examPapers: z.array(z.enum(['CS','DA'])).min(1).max(2).refine(v => new Set(v).size === v.length) })
export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  return NextResponse.json(createApiResponse({ examPapers: user.examPapers }))
}
export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = UpdateExamPapersSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })
  const supabase = await createSupabaseClient()
  const { error } = await supabase.from('user_profiles').update({ exam_papers: parsed.data.examPapers }).eq('id', user.id)
  if (error) return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Exam paper selection update failed'), { status: 500 })
  return NextResponse.json(createApiResponse({ examPapers: parsed.data.examPapers }, 'Exam papers updated'))
}
