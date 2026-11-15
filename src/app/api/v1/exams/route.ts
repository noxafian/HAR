import { NextRequest, NextResponse } from 'next/server'
import { requireApprovedMember } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

export async function GET(req: NextRequest) {
  const user = await requireApprovedMember().catch((error: unknown) => {
    const status = (error as { status?: number }).status ?? 401
    return status === 403 ? 'membership-denied' : null
  })
  if (user === null) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (user === 'membership-denied') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required'), { status: 403 })
  const paper = req.nextUrl.searchParams.get('paper')
  if (paper && paper !== 'CS' && paper !== 'DA') return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Paper must be CS or DA'), { status: 400 })
  const db = await createSupabaseClient()
  let query = db.from('mock_tests').select('id,title,paper,duration_minutes,total_questions,total_marks,scheduled_at,published_at,created_at').eq('status', 'published').eq('is_available', true).order('scheduled_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
  if (paper) query = query.eq('paper', paper)
  const { data, error } = await query.limit(100)
  if (error) {
    console.error('[exams.list]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve mock tests'), { status: 500 })
  }
  return NextResponse.json(createApiResponse({ items: data ?? [] }, 'Published mock tests retrieved'))
}
