import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { generateQuiz } from '@/lib/server/ai-generator'

const GenerateSchema = z.object({
  topic: z.string().min(1).max(200).trim(),
  subjectName: z.string().min(1).max(100).trim(),
  subject_id: z.string().min(1).max(100).trim(),
  count: z.number().int().min(5).max(65).default(65),
})

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json(createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message), { status: 401 })
  if (!user.isActive || user.role !== 'owner') {
    return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Owner access required'), { status: 403 })
  }
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json(createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Invalid JSON'), { status: 400 }) }
  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(createErrorResponse(ErrorCodes.VALIDATION_FAILED.id, parsed.error.issues[0]?.message ?? 'Validation failed'), { status: 400 })
  }
  try {
    const result = await generateQuiz(parsed.data.topic, parsed.data.subjectName, parsed.data.subject_id, parsed.data.count)
    return NextResponse.json(createApiResponse({ ...result, draft: true as const }, 'Questions generated — awaiting admin approval'))
  } catch (err) {
    // err.message is "All AI providers failed:\n• groq: ...\n• openrouter: ..."
    // Parse per-provider reasons into a structured details array for programmatic consumption.
    const rawMessage = err instanceof Error ? err.message : 'AI generation failed'
    const lines = rawMessage.split('\n')
    const header = lines[0] ?? rawMessage
    // Extract bullet-point lines (each starts with "• ") as individual detail strings
    const details: string[] = lines
      .slice(1)
      .filter((l: string) => l.startsWith('• '))
      .map((l: string) => l.slice(2).trim())

    const errorBody = createErrorResponse(ErrorCodes.PROVIDER_ERROR.id, header)
    return NextResponse.json(
      { ...errorBody, details },
      { status: 502 },
    )
  }
}
