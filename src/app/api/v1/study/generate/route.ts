/**
 * src/app/api/v1/study/generate/route.ts
 * POST /api/v1/study/generate - Generate flashcards or quiz questions with AI
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { generateFlashcards, generateQuiz } from '@/lib/server/ai-generator'
import { z } from 'zod'

export const maxDuration = 60

const generateSchema = z.object({
  type: z.enum(['flashcards', 'quiz']),
  subject_id: z.string().min(1),
  subject_name: z.string().min(1),
  topic: z.string().min(1),
  count: z.number().int().min(1).max(20).default(5)
})

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message, 401).error,
        { status: 401 }
      )
    }
    if (!user.isActive) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required', 403).error,
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Request body must be valid JSON', 400).error,
        { status: 400 }
      )
    }

    const parseResult = generateSchema.safeParse(body)
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0]
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.VALIDATION_FAILED.id,
          issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation failed',
          400
        ).error,
        { status: 400 }
      )
    }

    const { type, subject_id, subject_name, topic, count } = parseResult.data

    let result
    if (type === 'flashcards') {
      result = await generateFlashcards(topic, subject_name, subject_id, count)
    } else {
      result = await generateQuiz(topic, subject_name, subject_id, count)
    }

    return NextResponse.json(
      createApiResponse(
        { items: result.items, provider: result.provider, model: result.model },
        `Generated ${result.items.length} ${type} using ${result.provider}`
      ),
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate content'
    
    // Check if all providers failed — return the per-provider reasons so admin can diagnose
    if (message.includes('All AI providers failed')) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.SERVICE_UNAVAILABLE.id,
          message, // includes bullet-point per-provider reasons from ai-generator
          503
        ).error,
        { status: 503 }
      )
    }

    return NextResponse.json(
      createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, message, 500).error,
      { status: 500 }
    )
  }
}
