/**
 * src/lib/server/authorization.ts
 * Server-side permission and authorization checks
 */

import type { UserProfile } from '@/types/user'

/**
 * Permission matrix defining what roles can do
 */
const PERMISSION_MATRIX: Record<string, Record<string, string[]>> = {
  // Resource operations
  'resource:view': {
    owner: ['*'],
    member: ['own', 'shared'],
  },
  'resource:create': {
    owner: ['*'],
    member: ['own'],
  },
  'resource:edit': {
    owner: ['*'],
    member: ['own'],
  },
  'resource:delete': {
    owner: ['*'],
    member: ['own'],
  },

  // User management operations (Admin only)
  'member:list': {
    owner: ['*'],
    member: [],
  },
  'member:approve': {
    owner: ['*'],
    member: [],
  },
  'member:reject': {
    owner: ['*'],
    member: [],
  },
  'member:suspend': {
    owner: ['*'],
    member: [],
  },
  'member:update-role': {
    owner: ['*'],
    member: [],
  },

  // Content operations
  'content:moderate': {
    owner: ['*'],
    member: [],
  },
  'question:flag': {
    owner: ['*'],
    member: ['*'],
  },

  // Exam operations
  'exam:view': {
    owner: ['*'],
    member: ['*'],
  },
  'exam:submit': {
    owner: ['*'],
    member: ['*'],
  },
  'exam:view-results': {
    owner: ['*'],
    member: ['own'],
  },

  // Settings and profile
  'profile:view': {
    owner: ['own', 'members'],
    member: ['own'],
  },
  'profile:edit': {
    owner: ['own'],
    member: ['own'],
  },

  // Analytics
  'analytics:view': {
    owner: ['*'],
    member: ['own'],
  },

  // AI connections
  'ai-connection:manage': {
    owner: ['own'],
    member: ['own'],
  },
}

/**
 * Check if a user has a specific permission
 * @param user The user to check
 * @param permission The permission to check (e.g., 'resource:view')
 * @param scope Optional scope to check (e.g., 'own', 'shared', 'community')
 * @returns true if the user has the permission
 */
export function hasPermission(
  user: UserProfile | null,
  permission: string,
  scope?: string
): boolean {
  if (!user) return false

  const permissionRules = PERMISSION_MATRIX[permission]
  if (!permissionRules) {
    // Unknown permission - deny by default
    return false
  }

  const rolePermissions = permissionRules[user.role]
  if (!rolePermissions) {
    return false
  }

  // If no scope required, just check if permission exists
  if (!scope) {
    return rolePermissions.length > 0
  }

  // Check if the role has this permission for this scope
  return rolePermissions.includes('*') || rolePermissions.includes(scope)
}

/**
 * Check if a user has a specific role
 */
export function hasRole(user: UserProfile | null, role: string | string[]): boolean {
  if (!user) return false

  if (Array.isArray(role)) {
    return role.includes(user.role)
  }

  return user.role === role
}

/**
 * Check permission and throw if not allowed
 */
export function requirePermission(
  user: UserProfile | null,
  permission: string,
  scope?: string
): boolean {
  if (!hasPermission(user, permission, scope)) {
    throw new PermissionError(permission, user?.role)
  }
  return true
}

/**
 * Check role and throw if not allowed
 */
export function requireRole(user: UserProfile | null, role: string | string[]): boolean {
  if (!hasRole(user, role)) {
    throw new RoleError(Array.isArray(role) ? role : [role], user?.role)
  }
  return true
}

/**
 * Check if user is authenticated
 */
export function requireAuth(user: UserProfile | null): user is UserProfile {
  if (!user) {
    throw new AuthenticationError()
  }
  return true
}

/**
 * Custom error classes
 */
export class AuthenticationError extends Error {
  constructor() {
    super('Authentication required')
    this.name = 'AuthenticationError'
  }
}

export class PermissionError extends Error {
  constructor(permission: string, userRole?: string) {
    super(`Permission denied: ${permission}` + (userRole ? ` for role ${userRole}` : ''))
    this.name = 'PermissionError'
  }
}

export class RoleError extends Error {
  constructor(requiredRoles: string[], userRole?: string) {
    super(
      `Invalid role. Required: ${requiredRoles.join(' or ')}` +
        (userRole ? `, but user is ${userRole}` : '')
    )
    this.name = 'RoleError'
  }
}

/**
 * Check if user owns a resource (for future use with resource IDs)
 */
export function ownsResource(userId: string, resourceOwnerId: string): boolean {
  return userId === resourceOwnerId
}

/**
 * Check if user can access another user's data
 */
export function canAccessUserData(user: UserProfile, targetUserId: string): boolean {
  if (!user) return false

  // Owner can access any user's data
  if (user.role === 'owner') return true

  // Users can only access their own data
  return user.id === targetUserId
}

/**
 * Get the audit action for logging
 */
export function getAuditAction(permission: string, scope?: string): string {
  return `${permission}:${scope || 'default'}`
}
