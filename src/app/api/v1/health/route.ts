/**
 * GET /api/v1/health
 * Public health check — no authentication required
 */
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? 'unknown',
    },
    message: 'Service is healthy',
  })
}
