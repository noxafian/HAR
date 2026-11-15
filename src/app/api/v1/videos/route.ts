/** GET /api/v1/videos — published topic video lessons for approved members. */
import { NextRequest, NextResponse } from 'next/server'
import { requireApprovedMember } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

export async function GET(req: NextRequest) {
  const user = await requireApprovedMember().catch((error: unknown) => {
    const status = (error as { status?: number }).status ?? 401
    return status === 403 ? 'membership-denied' : null
  })
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (user === 'membership-denied') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required'), { status: 403 })

  const params = req.nextUrl.searchParams
  const paper = params.get('paper')
  const subject = params.get('subject')
  const topic = params.get('topic')

  const db = await createSupabaseClient()
  let query = db.from('topic_videos')
    .select('id,paper,subject_name,topic_name,youtube_id,title,description,duration_seconds,display_order,created_at')
    .eq('is_published', true)
  if (paper) query = query.eq('paper', paper)
  if (subject) query = query.eq('subject_name', subject)
  if (topic) query = query.eq('topic_name', topic)
  query = query.order('display_order', { ascending: true }).order('created_at', { ascending: false })
  const { data, error } = await query
  if (error) {
    console.error('[videos.list]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, 'Videos could not be loaded'), { status: 500 })
  }
  return NextResponse.json(createApiResponse({ items: data ?? [] }, 'Videos retrieved'))
}
