import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive || user.role !== 'owner') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  const db = await createSupabaseClient()
  const { data, error } = await db.rpc('admin_storage_summary')
  if (error) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Storage summary could not be loaded'), { status: 500 })
  return NextResponse.json(createApiResponse(data, 'Storage summary retrieved'))
}
