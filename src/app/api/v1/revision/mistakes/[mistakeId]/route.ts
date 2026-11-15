import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { UpdateMistakeSchema } from '@/schemas/revision.schema'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

type Ctx = { params: Promise<{ mistakeId: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  const { mistakeId } = await params
  if (!UUID.test(mistakeId)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid mistake ID'), { status: 400 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON body'), { status: 400 }) }
  const parsed = UpdateMistakeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })
  const update: Record<string, unknown> = {}
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes
  if (parsed.data.category !== undefined) update.category = parsed.data.category
  if (parsed.data.resolved !== undefined) update.resolved = parsed.data.resolved
  if (!Object.keys(update).length) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'No changes supplied'), { status: 400 })
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from('mistakes').update(update).eq('id', mistakeId).eq('user_id', user.id).select('id,notes,category,resolved,updated_at').maybeSingle()
  if (error) {
    console.error('[revision.mistakes.patch]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not update mistake'), { status: 500 })
  }
  if (!data) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Mistake not found'), { status: 404 })
  return NextResponse.json(createApiResponse(data, 'Mistake updated'))
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  const { mistakeId } = await params
  if (!UUID.test(mistakeId)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid mistake ID'), { status: 400 })
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from('mistakes').delete().eq('id', mistakeId).eq('user_id', user.id).select('id').maybeSingle()
  if (error) {
    console.error('[revision.mistakes.delete]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not delete mistake'), { status: 500 })
  }
  if (!data) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Mistake not found'), { status: 404 })
  return new NextResponse(null, { status: 204 })
}
