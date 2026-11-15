import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import type { AdminMockTest, AdminMockTestListResponse, MarkingConfig } from '@/types/admin-mock-studio'

const CreateMockTestSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  paper: z.enum(['CS', 'DA']),
  duration_minutes: z.number().int().min(1).max(480).default(180),
  mode: z.string().max(50).optional(),
  marking_config_id: z.string().uuid(),
})

async function authGuard() {
  const user = await getAuthenticatedUser()
  if (!user) return { error: NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 }), user: null }
  if (!user.isActive || user.role !== 'owner') {
    return { error: NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 }), user: null }
  }
  return { error: null, user }
}

export async function GET() {
  const { error } = await authGuard()
  if (error) return error
  const db = await createSupabaseClient()
  const [testsResult, configsResult] = await Promise.all([
    db.from('mock_tests').select('id,title,paper,duration_minutes,total_questions,total_marks,status,is_available,mode,created_at,updated_at', { count: 'exact' }).order('created_at', { ascending: false }),
    db.from('marking_configurations').select('id,name,paper').order('name'),
  ])
  if (testsResult.error) {
    console.error('[admin.mock-tests.get]', testsResult.error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not retrieve mock tests'), { status: 500 })
  }
  const items: AdminMockTest[] = (testsResult.data ?? []).map(row => ({
    id: row.id as string,
    title: row.title as string,
    paper: row.paper as 'CS' | 'DA',
    duration_minutes: row.duration_minutes as number,
    total_questions: row.total_questions as number | null,
    total_marks: row.total_marks as number | null,
    status: row.status as AdminMockTest['status'],
    is_available: row.is_available as boolean,
    mode: row.mode as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }))
  const marking_configs: MarkingConfig[] = (configsResult.data ?? []).map(row => ({
    id: row.id as string,
    name: row.name as string,
    paper: (row.paper ?? 'CS') as 'CS' | 'DA',
  }))
  const response: AdminMockTestListResponse = { items, total: testsResult.count ?? 0, marking_configs }
  return NextResponse.json(createApiResponse(response, 'Mock tests retrieved'))
}

export async function POST(req: NextRequest) {
  const { error, user } = await authGuard()
  if (error || !user) return error!
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = CreateMockTestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, parsed.error.issues[0]?.message ?? 'Validation failed'), { status: 400 })
  }
  const db = await createSupabaseClient()
  const { data, error: dbError } = await db.from('mock_tests').insert({
    title: parsed.data.title,
    paper: parsed.data.paper,
    duration_minutes: parsed.data.duration_minutes,
    mode: parsed.data.mode ?? 'practice',
    marking_config_id: parsed.data.marking_config_id,
    status: 'draft',
    is_available: false,
    created_by: user.id,
  }).select('id,title,paper,duration_minutes,total_questions,total_marks,status,is_available,mode,created_at,updated_at').single()
  if (dbError) {
    console.error('[admin.mock-tests.post]', dbError.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not create mock test'), { status: 500 })
  }
  return NextResponse.json(createApiResponse(data, 'Mock test created'), { status: 201 })
}
