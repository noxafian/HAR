/**
 * src/app/api/v1/ai/connections/route.ts
 * GET /api/v1/ai/connections - List user's AI connections (metadata only)
 * POST /api/v1/ai/connections - Connect a new personal AI provider
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { connectProviderSchema } from '@/schemas/ai.schema'
import { AIConnectionService } from '@/services/ai-connection.service'

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message, 401).error,
        { status: 401 }
      )
    }
    if (!user.isActive) return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required', 403).error, { status: 403 })

    const connections = await AIConnectionService.listConnections(user.id)
    return NextResponse.json(createApiResponse(connections, 'Connections retrieved successfully'), {
      status: 200,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve connections'
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, message, 500).error,
      { status: 500 }
    )
  }
}

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

    const parseResult = connectProviderSchema.safeParse(body)
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

    const connection = await AIConnectionService.connect(user.id, parseResult.data)

    return NextResponse.json(
      createApiResponse(connection, 'AI provider connected successfully'),
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to connect AI provider'
    const status = message.includes('already connected') ? 409 : 400

    return NextResponse.json(
      createErrorResponse(
        status === 409 ? ErrorCodes.DUPLICATE_REQUEST.id : ErrorCodes.INVALID_INPUT.id,
        message,
        status
      ).error,
      { status }
    )
  }
}
