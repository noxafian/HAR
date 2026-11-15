/**
 * src/app/api/v1/ai/chat/route.ts
 * POST /api/v1/ai/chat - Execute chat request with user's authenticated AI provider
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { chatRequestSchema } from '@/schemas/ai.schema'
import { AIConnectionService } from '@/services/ai-connection.service'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message, 401).error,
        { status: 401 }
      )
    }
    if (!user.isActive) return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required', 403).error, { status: 403 })

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Request body must be valid JSON', 400).error,
        { status: 400 }
      )
    }

    const parseResult = chatRequestSchema.safeParse(body)
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

    const result = await AIConnectionService.chat(user.id, {
      connectionId: parseResult.data.connectionId,
      provider: parseResult.data.provider,
      messages: parseResult.data.messages,
      temperature: parseResult.data.temperature,
      maxTokens: parseResult.data.maxTokens,
      stream: parseResult.data.stream,
    })

    // If stream was requested and returned as a ReadableStream
    if (result instanceof ReadableStream) {
      return new Response(result, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      })
    }

    return NextResponse.json(
      createApiResponse(result, 'AI response generated successfully'),
      { status: 200 }
    )
  } catch (error) {
    const errObj = error as { status?: number; code?: string; message?: string }
    const status = errObj.status || 500
    const message = errObj.message || 'Chat request failed'

    let errorCode: string = ErrorCodes.INTERNAL_SERVER_ERROR.id
    if (status === 429) errorCode = ErrorCodes.RATE_LIMIT_EXCEEDED.id
    if (status === 404) errorCode = ErrorCodes.RESOURCE_NOT_FOUND.id
    if (status === 400) errorCode = ErrorCodes.INVALID_INPUT.id
    if (status === 502) errorCode = ErrorCodes.PROVIDER_ERROR.id

    return NextResponse.json(
      createErrorResponse(errorCode, message, status).error,
      { status }
    )
  }
}
