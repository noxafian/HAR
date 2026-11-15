/** Server-only membership repository backed by canonical PostgreSQL tables/RPCs. */
import 'server-only'
import { createServiceRoleClient, createSupabaseClient } from '@/lib/server/supabase'

export type MembershipStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'removed'
export type UserRole = 'owner' | 'member'
export interface Membership {
  id: string; userId: string; status: MembershipStatus; role: UserRole; joinedAt: Date
  approvedAt?: Date; approvedBy?: string; rejectedAt?: Date; rejectedBy?: string
  rejectionReason?: string; suspendedAt?: Date; suspendedBy?: string; suspensionReason?: string
}
export interface JoinRequest {
  id: string; userId: string; email: string; displayName: string; requestedAt: Date
  status: 'pending' | 'approved' | 'rejected'; message?: string; respondedAt?: Date; respondedBy?: string
}
export interface MembershipRepository {
  getMembership(userId: string): Promise<Membership | null>
  getActiveMembers(filters?: MemberListFilters): Promise<Membership[]>
  isApprovedMember(userId: string): Promise<boolean>
  updateRole(userId: string, role: UserRole): Promise<Membership>
  suspendMember(userId: string, reason: string, suspendedBy: string): Promise<Membership>
  reactivateMember(userId: string): Promise<Membership>
  removeMember(userId: string): Promise<Membership>
  createJoinRequest(data: CreateJoinRequestInput): Promise<JoinRequest>
  getJoinRequest(userId: string): Promise<JoinRequest | null>
  getPendingRequests(limit?: number, offset?: number): Promise<JoinRequest[]>
  approveRequest(userId: string, approvedBy: string): Promise<JoinRequest>
  rejectRequest(userId: string, reason: string, rejectedBy: string): Promise<JoinRequest>
  countPendingRequests(): Promise<number>
}
export interface MemberListFilters { role?: UserRole; status?: MembershipStatus; search?: string; limit?: number; offset?: number }
export interface CreateJoinRequestInput { userId: string; email: string; displayName: string; message?: string }

type MembershipRow = Record<string, any>
function mapMembership(row: MembershipRow): Membership {
  return {
    id: row.id ?? row.user_id, userId: row.user_id, role: row.role, status: row.status,
    joinedAt: new Date(row.joined_at ?? row.created_at),
    approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
    approvedBy: row.approved_by ?? undefined, rejectedAt: row.rejected_at ? new Date(row.rejected_at) : undefined,
    rejectedBy: row.rejected_by ?? undefined, rejectionReason: row.rejection_reason ?? undefined,
    suspendedAt: row.suspended_at ? new Date(row.suspended_at) : undefined,
    suspendedBy: row.suspended_by ?? undefined, suspensionReason: row.suspension_reason ?? undefined,
  }
}
function mapRequest(row: MembershipRow): JoinRequest {
  return {
    id: row.id ?? row.request_id, userId: row.user_id, email: row.email, displayName: row.display_name,
    requestedAt: new Date(row.requested_at), status: row.status ?? 'pending', message: row.message ?? undefined,
    respondedAt: row.responded_at ? new Date(row.responded_at) : undefined, respondedBy: row.responded_by ?? undefined,
  }
}
async function membershipByUser(userId: string): Promise<Membership | null> {
  const db = createServiceRoleClient()
  const { data, error } = await db.from('memberships').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(`Membership lookup failed: ${error.message}`)
  return data ? mapMembership(data) : null
}

export function createMembershipRepository(): MembershipRepository {
  return {
    getMembership: membershipByUser,
    async getActiveMembers(filters = {}) {
      const db = await createSupabaseClient()
      let query = db.rpc('list_members', {
        p_status: filters.status ?? 'approved', p_limit: Math.min(200, Math.max(1, filters.limit ?? 50)),
        p_offset: Math.max(0, filters.offset ?? 0),
      })
      const { data, error } = await query
      if (error) throw new Error(`Member listing failed: ${error.message}`)
      return (data ?? []).filter((row: any) => !filters.role || row.role === filters.role)
        .filter((row: any) => !filters.search || `${row.display_name} ${row.email}`.toLowerCase().includes(filters.search!.toLowerCase()))
        .map((row: any) => mapMembership({ ...row, id: row.user_id }))
    },
    async isApprovedMember(userId) { return (await membershipByUser(userId))?.status === 'approved' },
    async updateRole(userId, role) {
      const db = await createSupabaseClient()
      const { error } = await db.rpc('set_member_role', { p_user_id: userId, p_role: role })
      if (error) throw new Error(`Membership role update failed: ${error.message}`)
      const membership = await membershipByUser(userId)
      if (!membership) throw new Error('Membership not found after update')
      return membership
    },
    async suspendMember(userId, reason, _suspendedBy) {
      const db = await createSupabaseClient()
      const { error } = await db.rpc('set_member_access', { p_user_id: userId, p_status: 'suspended', p_reason: reason })
      if (error) throw new Error(`Member suspension failed: ${error.message}`)
      const membership = await membershipByUser(userId)
      if (!membership) throw new Error('Membership not found after suspension')
      return membership
    },
    async reactivateMember(userId) {
      const db = await createSupabaseClient()
      const { error } = await db.rpc('set_member_access', { p_user_id: userId, p_status: 'approved', p_reason: null })
      if (error) throw new Error(`Member reactivation failed: ${error.message}`)
      const membership = await membershipByUser(userId)
      if (!membership) throw new Error('Membership not found after reactivation')
      return membership
    },
    async removeMember(userId) {
      const db = await createSupabaseClient()
      const { error } = await db.rpc('set_member_access', { p_user_id: userId, p_status: 'removed', p_reason: null })
      if (error) throw new Error(`Member removal failed: ${error.message}`)
      const membership = await membershipByUser(userId)
      if (!membership) throw new Error('Membership not found after removal')
      return membership
    },
    async createJoinRequest(input) {
      const db = await createSupabaseClient()
      const { data, error } = await db.rpc('submit_join_request', { p_message: input.message ?? null })
      if (error) throw new Error(`Join request submission failed: ${error.message}`)
      const result = (Array.isArray(data) ? data[0] : data) as { request_id?: string; request_status?: string } | null
      if (!result?.request_id) throw new Error(`Join request was not created (${result?.request_status ?? 'unknown result'})`)
      const { data: row, error: readError } = await db.from('join_requests').select('*').eq('id', result.request_id).single()
      if (readError) throw new Error(`Join request read-back failed: ${readError.message}`)
      return mapRequest(row)
    },
    async getJoinRequest(userId) {
      const db = createServiceRoleClient()
      const { data, error } = await db.from('join_requests').select('*').eq('user_id', userId).order('requested_at', { ascending: false }).limit(1).maybeSingle()
      if (error) throw new Error(`Join request lookup failed: ${error.message}`)
      return data ? mapRequest(data) : null
    },
    async getPendingRequests(limit = 20, offset = 0) {
      const db = await createSupabaseClient()
      const { data, error } = await db.rpc('list_pending_join_requests', { p_limit: Math.min(100, Math.max(1, limit)), p_offset: Math.max(0, offset) })
      if (error) throw new Error(`Pending request listing failed: ${error.message}`)
      return (data ?? []).map((row: any) => mapRequest({ ...row, id: row.request_id, status: 'pending' }))
    },
    async approveRequest(userId, _approvedBy) {
      const svc = createServiceRoleClient()
      const { data: request, error: lookupError } = await svc.from('join_requests').select('id').eq('user_id', userId).eq('status', 'pending').maybeSingle()
      if (lookupError) throw new Error(`Could not locate pending request: ${lookupError.message}`)
      if (!request) throw new Error('Pending join request not found')
      const db = await createSupabaseClient()
      const { error } = await db.rpc('approve_join_request', { p_request_id: request.id, p_role: 'member' })
      if (error) throw new Error(`Join request approval failed: ${error.message}`)
      const { data, error: readError } = await svc.from('join_requests').select('*').eq('id', request.id).single()
      if (readError) throw new Error(`Could not read approved request: ${readError.message}`)
      return mapRequest(data)
    },
    async rejectRequest(userId, reason, _rejectedBy) {
      const svc = createServiceRoleClient()
      const { data: request, error: lookupError } = await svc.from('join_requests').select('id').eq('user_id', userId).eq('status', 'pending').maybeSingle()
      if (lookupError) throw new Error(`Could not locate pending request: ${lookupError.message}`)
      if (!request) throw new Error('Pending join request not found')
      const db = await createSupabaseClient()
      const { error } = await db.rpc('reject_join_request', { p_request_id: request.id, p_reason: reason || null })
      if (error) throw new Error(`Join request rejection failed: ${error.message}`)
      const { data, error: readError } = await svc.from('join_requests').select('*').eq('id', request.id).single()
      if (readError) throw new Error(`Could not read rejected request: ${readError.message}`)
      return mapRequest(data)
    },
    async countPendingRequests() {
      const db = await createSupabaseClient()
      const { data, error } = await db.rpc('count_pending_join_requests')
      if (error) throw new Error(`Pending request count failed: ${error.message}`)
      return Number(data ?? 0)
    },
  }
}
