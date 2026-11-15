import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createSupabaseClient } from '@/lib/server/supabase'
import { UpdateTaskSchema } from '@/schemas/planner.schema'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'

type Ctx = { params: Promise<{ taskId: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  const { taskId } = await params
  if (!UUID.test(taskId)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid task ID'), { status: 400 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON body'), { status: 400 }) }
  const parsed = UpdateTaskSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'Validation failed'), { status: 400 })
  const update: Record<string, unknown> = {}
  if (parsed.data.title !== undefined) update.title = parsed.data.title
  if (parsed.data.description !== undefined) update.description = parsed.data.description
  if (parsed.data.scheduledDate !== undefined) update.scheduled_date = parsed.data.scheduledDate
  if (parsed.data.estimatedMinutes !== undefined) update.estimated_mins = parsed.data.estimatedMinutes
  if (parsed.data.priority !== undefined) update.priority = parsed.data.priority
  if (parsed.data.completed !== undefined) {
    update.completed = parsed.data.completed
    update.completed_at = parsed.data.completed ? new Date().toISOString() : null
  }
  if (!Object.keys(update).length) return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, 'No changes supplied'), { status: 400 })
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from('planner_tasks').update(update).eq('id', taskId).eq('user_id', user.id).select('id,title,description,scheduled_date,estimated_mins,priority,completed,completed_at,updated_at').maybeSingle()
  if (error) {
    console.error('[planner.tasks.patch]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not update task'), { status: 500 })
  }
  if (!data) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Task not found'), { status: 404 })
  return NextResponse.json(createApiResponse(data, 'Task updated'))
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  const { taskId } = await params
  if (!UUID.test(taskId)) return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid task ID'), { status: 400 })
  const supabase = await createSupabaseClient()
  const { data, error } = await supabase.from('planner_tasks').delete().eq('id', taskId).eq('user_id', user.id).select('id').maybeSingle()
  if (error) {
    console.error('[planner.tasks.delete]', error.message)
    return NextResponse.json(createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Could not delete task'), { status: 500 })
  }
  if (!data) return NextResponse.json(createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Task not found'), { status: 404 })
  return new NextResponse(null, { status: 204 })
}
