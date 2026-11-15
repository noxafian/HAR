/** Server-side structured audit logging with redaction and durable DB persistence. */

export type AuditAction =
  | 'auth.register' | 'auth.login' | 'auth.logout' | 'auth.refresh'
  | 'member.join_request' | 'member.approved' | 'member.rejected' | 'member.suspended'
  | 'member.removed' | 'member.role_changed' | 'resource.uploaded' | 'resource.deleted'
  | 'resource.downloaded' | 'resource.reported' | 'resource.moderated' | 'question.submitted' | 'question.moderated'
  | 'question.reported' | 'exam.session_started' | 'exam.submitted' | 'ai.connection_created'
  | 'ai.connection_verified' | 'ai.connection_deleted' | 'ai.key_rotated'
  | 'admin.action' | 'admin.owner_bootstrapped'

export interface AuditEvent {
  action: AuditAction; userId: string; resourceType: string; resourceId: string
  status: 'success' | 'failure'; errorMessage?: string; ipAddress?: string
  userAgent?: string; metadata?: Record<string, unknown>; timestamp: string
}

const SENSITIVE_KEYS = [
  'password', 'apikey', 'api_key', 'token', 'secret', 'accesstoken',
  'refreshtoken', 'credential', 'key', 'authorization', 'cookie', 'encrypted',
]

function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    const normalized = key.toLowerCase().replace(/[-_]/g, '')
    sanitized[key] = SENSITIVE_KEYS.some(sensitive => normalized.includes(sensitive.replace(/[-_]/g, '')))
      ? '[REDACTED]' : value
  }
  return sanitized
}

/**
 * Emits a redacted structured server log immediately, then awaits a service-only
 * database write. Persistence errors are logged but do not roll back the primary action.
 */
export async function logAuditEvent(
  action: AuditAction,
  userId: string,
  resourceType: string,
  resourceId: string,
  options: {
    status?: 'success' | 'failure'; errorMessage?: string; ipAddress?: string
    userAgent?: string; metadata?: Record<string, unknown>
  } = {},
): Promise<void> {
  const event: AuditEvent = {
    action, userId, resourceType, resourceId, status: options.status ?? 'success',
    errorMessage: options.errorMessage, ipAddress: options.ipAddress, userAgent: options.userAgent,
    metadata: sanitizeMetadata(options.metadata), timestamp: new Date().toISOString(),
  }
  console.log(JSON.stringify({ audit: event }))
  if (process.env.NODE_ENV === 'test') return
  try {
    const { createServiceRoleClient } = await import('@/lib/server/supabase')
    const db = createServiceRoleClient()
    const { error } = await db.rpc('write_audit_event', {
      p_action: event.action, p_user_id: event.userId, p_resource_type: event.resourceType,
      p_resource_id: event.resourceId, p_status: event.status,
      p_error_message: event.errorMessage ?? null,
      p_metadata: { ...(event.metadata ?? {}), ...(event.ipAddress ? { ipAddress: event.ipAddress } : {}), ...(event.userAgent ? { userAgent: event.userAgent } : {}) },
    })
    if (error) throw new Error(error.message)
  } catch (error) {
    // Audit failure is observable in server logs but must not roll back the primary action.
    console.error('[audit.persistence]', error instanceof Error ? error.message : 'Audit persistence failed')
  }
}
