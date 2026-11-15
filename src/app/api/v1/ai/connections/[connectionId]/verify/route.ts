/**
 * src/app/api/v1/ai/connections/[connectionId]/verify/route.ts
 * POST /api/v1/ai/connections/[connectionId]/verify - Test provider connectivity
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { createApiResponse, createErrorResponse, ErrorCodes } from '@/lib/server/response'
import { verifyConnectionSchema } from '@/schemas/ai.schema'
import { AIConnectionService } from '@/services/ai-connection.service'

interface RouteContext {
  params: Promise<{ connectionId: string }>
}

export async function POST(req: NextRequest, { params }: RouteContext) {
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
    const body = await req.json().catch(() => ({}))
    const parseResult = verifyConnectionSchema.safeParse(body)

    const modelId = parseResult.success ? parseResult.data.modelId : undefined
    const result = await AIConnectionService.verify(user.id, connectionId, modelId)

    if (!result.valid) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCodes.PROVIDER_ERROR.id,
          result.error || 'Connection verification failed with provider',
          400
        ).error,
        { status: 400 }
      )
    }

    return NextResponse.json(
      createApiResponse(
        { connectionId, valid: true, model: result.model },
        'AI provider connection verified successfully'
      ),
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed'
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INTERNAL_SERVER_ERROR.id, message, 500).error,
      { status: 500 }
    )
  }
}

