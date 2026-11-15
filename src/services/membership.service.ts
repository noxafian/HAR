import type { Membership, AccessRequest } from '@/types/membership'
import type { UserProfile } from '@/types/user'

/**
 * Membership service interface.
 * Implementation: Phase B.
 */
export interface MembershipService {
  requestAccess(data: AccessRequest): Promise<void>
  getPendingRequests(): Promise<(AccessRequest & { id: string; requestedAt: Date })[]>
  approveRequest(requestId: string): Promise<void>
  rejectRequest(requestId: string, reason: string): Promise<void>
  getMembers(): Promise<UserProfile[]>
  suspendMember(userId: string): Promise<void>
  updateRole(userId: string, role: UserProfile['role']): Promise<void>
  getMembership(userId: string): Promise<Membership | null>
}
