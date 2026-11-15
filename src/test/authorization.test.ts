/**
 * Authorization permission matrix tests
 */
import { describe, it, expect } from 'vitest'
import {
  hasPermission,
  hasRole,
  ownsResource,
  canAccessUserData,
} from '@/lib/server/authorization'
import type { UserProfile } from '@/types/user'

const owner: UserProfile = {
  id: 'owner-1', email: 'owner@test.com', displayName: 'Owner',
  role: 'owner', avatarUrl: null, examPapers: ['CS'], joinedAt: new Date(), isActive: true,
}
const moderator: UserProfile = {
  id: 'mod-1', email: 'mod@test.com', displayName: 'Mod',
  role: 'member', avatarUrl: null, examPapers: ['CS'], joinedAt: new Date(), isActive: true,
}
const member: UserProfile = {
  id: 'member-1', email: 'member@test.com', displayName: 'Member',
  role: 'member', avatarUrl: null, examPapers: ['CS'], joinedAt: new Date(), isActive: true,
}

describe('Member approval permissions', () => {
  it('owner can approve members', () => {
    expect(hasPermission(owner, 'member:approve')).toBe(true)
  })
  it('moderator cannot approve members', () => {
    expect(hasPermission(moderator, 'member:approve')).toBe(false)
  })
  it('member cannot approve members', () => {
    expect(hasPermission(member, 'member:approve')).toBe(false)
  })
})

describe('Resource permissions', () => {
  it('owner has wildcard resource access', () => {
    expect(hasPermission(owner, 'resource:delete')).toBe(true)
  })
  it('moderator can edit shared resources', () => {
    expect(hasPermission(moderator, 'resource:edit', 'shared')).toBe(true)
  })
  it('member cannot delete shared resources', () => {
    expect(hasPermission(member, 'resource:delete', 'shared')).toBe(false)
  })
  it('member can delete own resources', () => {
    expect(hasPermission(member, 'resource:delete', 'own')).toBe(true)
  })
})

describe('Exam permissions', () => {
  it('member can submit exams', () => {
    expect(hasPermission(member, 'exam:submit')).toBe(true)
  })
  it('member can view own results', () => {
    expect(hasPermission(member, 'exam:view-results', 'own')).toBe(true)
  })
  it('member cannot view other results', () => {
    expect(hasPermission(member, 'exam:view-results', 'other')).toBe(false)
  })
  it('owner can view all results', () => {
    expect(hasPermission(owner, 'exam:view-results')).toBe(true)
  })
})

describe('AI connection permissions', () => {
  it('member can manage own AI connections', () => {
    expect(hasPermission(member, 'ai-connection:manage', 'own')).toBe(true)
  })
  it('member cannot manage other AI connections', () => {
    expect(hasPermission(member, 'ai-connection:manage', 'other')).toBe(false)
  })
  it('owner cannot manage other AI connections (privacy)', () => {
    // Owner has 'own' scope only — cannot read other members' keys
    expect(hasPermission(owner, 'ai-connection:manage', 'other')).toBe(false)
  })
})

describe('Profile permissions', () => {
  it('all roles can edit own profile', () => {
    expect(hasPermission(owner, 'profile:edit', 'own')).toBe(true)
    expect(hasPermission(moderator, 'profile:edit', 'own')).toBe(true)
    expect(hasPermission(member, 'profile:edit', 'own')).toBe(true)
  })
  it('member cannot edit others profile', () => {
    expect(hasPermission(member, 'profile:edit', 'other')).toBe(false)
  })
})

describe('Unknown permissions default to deny', () => {
  it('unknown permission returns false for all roles', () => {
    expect(hasPermission(owner, 'unknown:action')).toBe(false)
    expect(hasPermission(member, 'unknown:action')).toBe(false)
  })
  it('null user always returns false', () => {
    expect(hasPermission(null, 'resource:view')).toBe(false)
  })
})

describe('hasRole', () => {
  it('matches single role', () => {
    expect(hasRole(owner, 'owner')).toBe(true)
    expect(hasRole(member, 'owner')).toBe(false)
  })
  it('matches from array', () => {
    expect(hasRole(moderator, ['owner', 'moderator'])).toBe(true)
    expect(hasRole(member, ['owner', 'moderator'])).toBe(false)
  })
})

describe('ownsResource', () => {
  it('returns true when userId matches resourceOwnerId', () => {
    expect(ownsResource('user-1', 'user-1')).toBe(true)
  })
  it('returns false for different users', () => {
    expect(ownsResource('user-1', 'user-2')).toBe(false)
  })
})

describe('canAccessUserData', () => {
  it('owner can access any user data', () => {
    expect(canAccessUserData(owner, 'some-other-user')).toBe(true)
  })
  it('member can access own data', () => {
    expect(canAccessUserData(member, member.id)).toBe(true)
  })
  it('member cannot access other member data', () => {
    expect(canAccessUserData(member, 'different-user-id')).toBe(false)
  })
})
