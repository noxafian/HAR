export type MembershipStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended'

export interface Membership {
  id: string
  userId: string
  status: MembershipStatus
  requestedAt: Date
  reviewedAt: Date | null
  reviewedBy: string | null
  reason: string | null
}

export interface AccessRequest {
  fullName: string
  email: string
  reason: string
}
