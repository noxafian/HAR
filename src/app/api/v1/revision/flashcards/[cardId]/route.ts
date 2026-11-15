import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { UpdateFlashcardSchema } from '@/schemas/revision.schema'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

type Ctx = { params: Promise<{ cardId: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  const { cardId } = await params
  if (!UUID.test(cardId)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid flashcard ID'), { status: 400 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON body'), { status: 400 }) }
  const parsed = UpdateFlashcardSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })
  const supabase = await createSupabaseClient()
  if (parsed.data.reviewResult) {
    const { data, error } = await supabase.rpc('review_flashcard', { p_flashcard_id: cardId, p_result: parsed.data.reviewResult })
    if (error) {
      if (error.code === 'P0002') return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Flashcard not found'), { status: 404 })
      if (error.code === '42501') return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required'), { status: 403 })
      console.error('[revision.flashcards.review]', error.message)
      return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not save review'), { status: 500 })
    }
    const row = Array.isArray(data) ? data[0] : data
    return NextResponse.json(createApiResponse(row, 'Flashcard review recorded'))
  }
  const update: Record<string, unknown> = {}
  if (parsed.data.front !== undefined) update.front = parsed.data.front
  if (parsed.data.back !== undefined) update.back = parsed.data.back
  if (parsed.data.difficulty !== undefined) update.difficulty = parsed.data.difficulty
  if (!Object.keys(update).length) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'No changes supplied'), { status: 400 })
  const { data, error } = await supabase.from('flashcards').update(update).eq('id', cardId).eq('user_id', user.id).select('id,front,back,difficulty,next_review_at,review_count,updated_at').maybeSingle()
  if (error) {
    console.error('[revision.flashcards.patch]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not update flashcard'), { status: 500 })
  }
  if (!data) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Flashcard not found'), { status: 404 })
  return NextResponse.json(createApiResponse(data, 'Flashcard updated'))
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  const { cardId } = await params
  if (!UUID.test(cardId)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid flashcard ID'), { status: 400 })
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from('flashcards').delete().eq('id', cardId).eq('user_id', user.id).select('id').maybeSingle()
  if (error) {
    console.error('[revision.flashcards.delete]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not delete flashcard'), { status: 500 })
  }
  if (!data) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Flashcard not found'), { status: 404 })
  return new NextResponse(null, { status: 204 })
}
