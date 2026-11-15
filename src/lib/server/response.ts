/**
 * src/lib/server/response.ts
 * Consistent API response formatting and error handling
 */

import type { ApiResponse, ApiError } from './types'

/**
 * Create a successful API response
 */
export function createApiResponse<T>(
  data: T,
  message?: string,
  meta?: Record<string, unknown>
): ApiResponse<T> {
  return {
    success: true,
    data,
    message: message || 'Operation successful',
    meta,
  }
}

/**
 * Create an error response
 */
export function createErrorResponse(
  errorId: string,
  message: string,
  statusCode: number = 400
): { status: number; error: ApiError } {
  return {
    status: statusCode,
    error: {
      success: false,
      errorId,
      message,
      timestamp: new Date().toISOString(),
    },
  }
}

/**
 * Standard error codes
 */
export const ErrorCodes = {
  // Authentication errors (4xx)
  UNAUTHENTICATED: { id: 'UNAUTHENTICATED', status: 401, message: 'Authentication required' },
  INVALID_CREDENTIALS: { id: 'INVALID_CREDENTIALS', status: 401, message: 'Invalid credentials' },
  SESSION_EXPIRED: { id: 'SESSION_EXPIRED', status: 401, message: 'Session expired' },
  TOKEN_INVALID: { id: 'TOKEN_INVALID', status: 401, message: 'Invalid or malformed token' },

  // Authorization errors (403)
  INSUFFICIENT_PERMISSIONS: {
    id: 'INSUFFICIENT_PERMISSIONS',
    status: 403,
    message: 'Insufficient permissions for this operation',
  },
  MEMBERSHIP_PENDING: {
    id: 'MEMBERSHIP_PENDING',
    status: 403,
    message: 'Membership approval pending',
  },
  MEMBERSHIP_REJECTED: {
    id: 'MEMBERSHIP_REJECTED',
    status: 403,
    message: 'Membership request rejected',
  },
  MEMBERSHIP_SUSPENDED: {
    id: 'MEMBERSHIP_SUSPENDED',
    status: 403,
    message: 'Account suspended',
  },

  // Not found errors (404)
  RESOURCE_NOT_FOUND: { id: 'RESOURCE_NOT_FOUND', status: 404, message: 'Resource not found' },
  USER_NOT_FOUND: { id: 'USER_NOT_FOUND', status: 404, message: 'User not found' },
  EXAM_NOT_FOUND: { id: 'EXAM_NOT_FOUND', status: 404, message: 'Exam not found' },
  QUESTION_NOT_FOUND: { id: 'QUESTION_NOT_FOUND', status: 404, message: 'Question not found' },

  // Validation errors (400)
  VALIDATION_FAILED: { id: 'VALIDATION_FAILED', status: 400, message: 'Validation failed' },
  INVALID_REQUEST: { id: 'INVALID_REQUEST', status: 400, message: 'Invalid request' },
  INVALID_INPUT: { id: 'INVALID_INPUT', status: 400, message: 'Invalid input' },
  MISSING_REQUIRED_FIELD: {
    id: 'MISSING_REQUIRED_FIELD',
    status: 400,
    message: 'Missing required field',
  },
  FILE_TOO_LARGE: { id: 'FILE_TOO_LARGE', status: 400, message: 'File too large' },
  UNSUPPORTED_FILE_TYPE: {
    id: 'UNSUPPORTED_FILE_TYPE',
    status: 400,
    message: 'Unsupported file type',
  },
  DUPLICATE_RESOURCE: {
    id: 'DUPLICATE_RESOURCE',
    status: 400,
    message: 'Duplicate resource exists',
  },

  // Conflict errors (409)
  DUPLICATE_EMAIL: { id: 'DUPLICATE_EMAIL', status: 409, message: 'Email already registered' },
  DUPLICATE_REQUEST: { id: 'DUPLICATE_REQUEST', status: 409, message: 'Duplicate request' },
  EXAM_ALREADY_SUBMITTED: {
    id: 'EXAM_ALREADY_SUBMITTED',
    status: 409,
    message: 'Exam already submitted',
  },
  RESOURCE_CONFLICT: { id: 'RESOURCE_CONFLICT', status: 409, message: 'Resource conflict' },

  // Rate limit errors (429)
  RATE_LIMIT_EXCEEDED: {
    id: 'RATE_LIMIT_EXCEEDED',
    status: 429,
    message: 'Rate limit exceeded',
  },
  DAILY_LIMIT_EXCEEDED: {
    id: 'DAILY_LIMIT_EXCEEDED',
    status: 429,
    message: 'Daily limit exceeded',
  },
  MONTHLY_LIMIT_EXCEEDED: {
    id: 'MONTHLY_LIMIT_EXCEEDED',
    status: 429,
    message: 'Monthly limit exceeded',
  },

  // Server errors (5xx)
  INTERNAL_SERVER_ERROR: {
    id: 'INTERNAL_SERVER_ERROR',
    status: 500,
    message: 'Internal server error',
  },
  DATABASE_ERROR: { id: 'DATABASE_ERROR', status: 500, message: 'Database error' },
  PROVIDER_ERROR: { id: 'PROVIDER_ERROR', status: 502, message: 'Provider error' },
  PROVIDER_TIMEOUT: { id: 'PROVIDER_TIMEOUT', status: 504, message: 'Provider timeout' },
  STORAGE_ERROR: { id: 'STORAGE_ERROR', status: 500, message: 'Storage error' },
  ENCRYPTION_ERROR: { id: 'ENCRYPTION_ERROR', status: 500, message: 'Encryption error' },
  SERVICE_UNAVAILABLE: {
    id: 'SERVICE_UNAVAILABLE',
    status: 503,
    message: 'Service temporarily unavailable',
  },
} as const

/**
 * Create an error response with standard error code
 */
export function createStandardError(
  errorCode: (typeof ErrorCodes)[keyof typeof ErrorCodes],
  customMessage?: string
) {
  return createErrorResponse(errorCode.id, customMessage || errorCode.message, errorCode.status)
}

/**
 * Format validation errors from Zod or other validators
 */
export function formatValidationErrors(
  errors: Record<string, string | string[]>
): Record<string, string> {
  const formatted: Record<string, string> = {}

  Object.entries(errors).forEach(([field, error]) => {
    if (Array.isArray(error)) {
      formatted[field] = error[0]
    } else {
      formatted[field] = error
    }
  })

  return formatted
}
