/**
 * src/lib/server/index.ts
 * Server-only module exports
 * These utilities are only available in server components and API routes
 */

export { createSupabaseClient } from './supabase'
export { createServiceRoleClient } from './supabase'
export { encryptCredential, decryptCredential } from './encryption'
export { requireAuth } from './auth'
export { hasPermission, hasRole } from './authorization'
export { createApiResponse, createErrorResponse } from './response'
export type { ApiResponse, ApiError, ApiContext } from './types'
