/**
 * src/app/api/v1/study/mistakes/auto/route.ts
 * POST /api/v1/study/mistakes/auto - Auto-populate mistake from quiz/mock test result
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { createSupabaseClient } from '@/lib/server/supabase'
import { z } from 'zod'

const autoMistakeSchema = z.object({
  question_id: z.string().uuid(),
  your_answer: z.string().min(1),
  correct_answer: z.string().optional(), // caller supplies this from quiz result
  source_type: z.enum(['topic_quiz', 'mock_test']),
  source_ref: z.string().optional()
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

    const parseResult = autoMistakeSchema.safeParse(body)
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

    const { question_id, your_answer, correct_answer, source_type, source_ref } = parseResult.data
    const supabase = await createSupabaseClient()

    // Fetch question details
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('subject_id, topic_id, prompt, explanation')
      .eq('id', question_id)
      .maybeSingle()

    if (questionError || !question) {
      console.error('[Auto Mistake] Error fetching question:', questionError)
      return NextResponse.json(
        createErrorResponse(ErrorCodes.QUESTION_NOT_FOUND.id, 'Question not found', 404).error,
        { status: 404 }
      )
    }

    // Insert mistake record
    const { data: mistake, error: mistakeError } = await supabase
      .from('mistakes')
      .insert({
        user_id: user.id,
        question_id,
        question_text: question.prompt,
        my_answer: your_answer,
        your_answer,
        correct_answer: correct_answer ?? null, // supplied by quiz caller who knows the right answer
        explanation: question.explanation || null,
        subject_id: question.subject_id,
        topic_id: question.topic_id,
        source_type,
        source_ref: source_ref || null,
        category: 'Conceptual',
        resolved: false
      })
      .select()
      .single()

    if (mistakeError) {
      console.error('[Auto Mistake] Error creating mistake:', mistakeError)
      return NextResponse.json(
        createErrorResponse(ErrorCodes.DATABASE_ERROR.id, 'Failed to log mistake', 500).error,
        { status: 500 }
      )
    }

    return NextResponse.json(
      createApiResponse(mistake, 'Mistake logged successfully'),
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to log mistake'
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, message, 500).error,
      { status: 500 }
    )
  }
}
