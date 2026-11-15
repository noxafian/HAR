/**
 * src/app/api/v1/ai/connections/[connectionId]/route.ts
 * GET /api/v1/ai/connections/[connectionId] - Get connection metadata
 * PATCH /api/v1/ai/connections/[connectionId] - Rotate key / update model
 * DELETE /api/v1/ai/connections/[connectionId] - Disconnect provider
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { rotateKeySchema } from '@/schemas/ai.schema'
import { AIConnectionService } from '@/services/ai-connection.service'

interface RouteContext {
  params: Promise<{ connectionId: string }>
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message, 401).error,
        { status: 401 }
      )
    }
    if (!user.isActive) return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required', 403).error, { status: 403 })

    const { connectionId } = await params
    const connection = await AIConnectionService.getConnection(user.id, connectionId)

    if (!connection) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Connection not found', 404).error,
        { status: 404 }
      )
    }

    return NextResponse.json(
      createApiResponse(connection, 'Connection retrieved successfully'),
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve connection'
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, message, 500).error,
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message, 401).error,
        { status: 401 }
      )
    }
    if (!user.isActive) return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required', 403).error, { status: 403 })

    const { connectionId } = await params
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INVALID_REQUEST.id, 'Request body must be valid JSON', 400).error,
        { status: 400 }
      )
    }

    const parseResult = rotateKeySchema.safeParse(body)
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

    const updated = await AIConnectionService.rotateKey(user.id, connectionId, parseResult.data)

    return NextResponse.json(
      createApiResponse(updated, 'API key rotated successfully'),
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to rotate key'
    const status = message.includes('not found') ? 404 : 400

    return NextResponse.json(
      createErrorResponse(
        status === 404 ? ErrorCodes.RESOURCE_NOT_FOUND.id : ErrorCodes.INVALID_INPUT.id,
        message,
        status
      ).error,
      { status }
    )
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.UNAUTHENTICATED.id, ErrorCodes.UNAUTHENTICATED.message, 401).error,
        { status: 401 }
      )
    }
    if (!user.isActive) return NextResponse.json(createErrorResponse(ErrorCodes.INSUFFICIENT_PERMISSIONS.id, 'Approved membership required', 403).error, { status: 403 })

    const { connectionId } = await params
    const success = await AIConnectionService.disconnect(user.id, connectionId)

    if (!success) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.RESOURCE_NOT_FOUND.id, 'Connection not found', 404).error,
        { status: 404 }
      )
    }

    return NextResponse.json(
      createApiResponse({ id: connectionId, disconnected: true }, 'AI provider disconnected successfully'),
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to disconnect'
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, message, 500).error,
      { status: 500 }
    )
  }
}

