import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

type Ctx = { params: Promise<{ itemId: string }> }

export async function PATCH(_req: Request, { params }: Ctx) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive) return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required'), { status: 403 })
  const { itemId } = await params
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.rpc('complete_revision_item', { p_item_id: itemId })
  if (error) {
    const status = error.code === 'P0002' ? 404 : error.code === '42501' ? 403 : 500
    return NextResponse.json(createErrorResponse(status === 404 ? ErrorCodes.RESOURCE_NOT_FOUND.id : status === 403 ? ErrorCodes.INSUFFICIENT_PERMISSIONS.id : ErrorCodes.DATABASE_ERROR.id, status === 500 ? 'Could not complete revision' : error.message), { status })
  }
  return NextResponse.json(createApiResponse(data, 'Revision completed and next review scheduled'))
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  const { itemId } = await params
  const supabase = await createSupabaseClient()
  const { error, count } = await supabase.from('revision_items').delete({ count: 'exact' }).eq('id', itemId).eq('user_id', user.id)
  if (error) return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not remove revision item'), { status: 500 })
  if (!count) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Revision item not found'), { status: 404 })
  return NextResponse.json(createApiResponse({ deleted: true }, 'Revision item removed'))
}
