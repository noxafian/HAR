export type UserRole = 'owner' | 'member'

export interface UserProfile {
  id: string
  displayName: string
  email: string
  role: UserRole
  avatarUrl: string | null
  examPapers: ('CS' | 'DA')[]
  joinedAt: Date
  isActive: boolean
  membershipStatus?: 'pending' | 'approved' | 'rejected' | 'suspended' | 'removed'
}

export interface Owner extends UserProfile {
  role: 'owner'
}

export interface Member extends UserProfile {
  role: 'member'
}
