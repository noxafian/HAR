/** Server-only PostgreSQL implementation of the user repository. */
import 'server-only'
import { createServiceRoleClient } from '@/lib/server/supabase'
import type { UserProfile, UserRole } from '@/types/user'

export interface UserRepository {
  findById(userId: string): Promise<UserProfile | null>
  findByEmail(email: string): Promise<UserProfile | null>
  create(data: CreateUserInput): Promise<UserProfile>
  update(userId: string, data: UpdateUserInput): Promise<UserProfile>
  getExamPapers(userId: string): Promise<string[]>
  updateExamPapers(userId: string, papers: string[]): Promise<void>
  getPrivacySettings(userId: string): Promise<PrivacySettings>
  updatePrivacySettings(userId: string, settings: PrivacySettings): Promise<void>
  list(filters?: UserListFilters): Promise<UserProfile[]>
  deactivate(userId: string): Promise<void>
  reactivate(userId: string): Promise<void>
  delete(userId: string): Promise<void>
}

export interface CreateUserInput { id: string; email: string; displayName: string; avatarUrl?: string; examPapers?: string[] }
export interface UpdateUserInput { displayName?: string; avatarUrl?: string; isActive?: boolean }
export interface PrivacySettings { profilePublic: boolean; showStudyStats: boolean; allowMessages: boolean; showAnalytics: boolean }
export interface UserListFilters { role?: string; isActive?: boolean; search?: string; limit?: number; offset?: number }

type ProfileRow = {
  id: string; email: string; display_name: string; avatar_url: string | null
  exam_papers: ('CS' | 'DA')[]; created_at: string
  role?: UserRole; status?: string; joined_at?: string | null
}

function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role ?? 'member',
    avatarUrl: row.avatar_url,
    examPapers: row.exam_papers ?? ['CS'],
    joinedAt: new Date(row.joined_at ?? row.created_at),
    isActive: row.status === 'approved',
  }
}

function assertResult<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(`User repository operation failed: ${error.message}`)
  if (data === null) throw new Error('User repository returned no data')
  return data
}

export function createUserRepository(): UserRepository {
  return {
    async findById(userId) {
      const db = createServiceRoleClient()
      const { data, error } = await db.from('user_profiles')
        .select('id,email,display_name,avatar_url,exam_papers,created_at,memberships!inner(role,status,joined_at)')
        .eq('id', userId).maybeSingle()
      if (error) throw new Error(`Could not load user: ${error.message}`)
      if (!data) return null
      const membership = Array.isArray(data.memberships) ? data.memberships[0] : data.memberships
      return mapProfile({ ...data, role: membership?.role, status: membership?.status, joined_at: membership?.joined_at } as ProfileRow)
    },
    async findByEmail(email) {
      const db = createServiceRoleClient()
      const { data, error } = await db.from('user_profiles')
        .select('id,email,display_name,avatar_url,exam_papers,created_at,memberships!inner(role,status,joined_at)')
        .eq('email', email.trim().toLowerCase()).maybeSingle()
      if (error) throw new Error(`Could not find user by email: ${error.message}`)
      if (!data) return null
      const membership = Array.isArray(data.memberships) ? data.memberships[0] : data.memberships
      return mapProfile({ ...data, role: membership?.role, status: membership?.status, joined_at: membership?.joined_at } as ProfileRow)
    },
    async create(input) {
      // Auth signup trigger owns profile/membership creation; this method only
      // reconciles the profile after an Auth user has already been created.
      const db = createServiceRoleClient()
      const { data, error } = await db.from('user_profiles').upsert({
        id: input.id, email: input.email, display_name: input.displayName,
        avatar_url: input.avatarUrl ?? null, exam_papers: input.examPapers ?? ['CS'],
      }, { onConflict: 'id' }).select('id,email,display_name,avatar_url,exam_papers,created_at').single()
      if (error) throw new Error(`Could not reconcile user profile: ${error.message}`)
      const { data: membership, error: membershipError } = await db.from('memberships')
        .select('role,status,joined_at').eq('user_id', input.id).maybeSingle()
      if (membershipError) throw new Error(`Could not load initial membership: ${membershipError.message}`)
      return mapProfile({ ...data, role: membership?.role, status: membership?.status, joined_at: membership?.joined_at } as ProfileRow)
    },
    async update(userId, input) {
      const db = createServiceRoleClient()
      const patch: Record<string, unknown> = {}
      if (input.displayName !== undefined) patch.display_name = input.displayName
      if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl
      if (Object.keys(patch).length === 0) {
        const found = await this.findById(userId)
        if (!found) throw new Error('User not found')
        return found
      }
      const { data, error } = await db.from('user_profiles').update(patch).eq('id', userId)
        .select('id,email,display_name,avatar_url,exam_papers,created_at').single()
      if (error) throw new Error(`Could not update user profile: ${error.message}`)
      const { data: membership, error: membershipError } = await db.from('memberships')
        .select('role,status,joined_at').eq('user_id', userId).maybeSingle()
      if (membershipError) throw new Error(`Could not load membership: ${membershipError.message}`)
      const result = mapProfile({ ...data, role: membership?.role, status: membership?.status, joined_at: membership?.joined_at } as ProfileRow)
      if (input.isActive !== undefined && input.isActive !== result.isActive) {
        const userClient = await import('@/lib/server/supabase').then(module => module.createSupabaseClient())
        const { error: membershipError } = await userClient.rpc('set_member_access', {
          p_user_id: userId, p_status: input.isActive ? 'approved' : 'suspended', p_reason: input.isActive ? null : 'Deactivated by administrator',
        })
        if (membershipError) throw new Error(`Could not update membership status: ${membershipError.message}`)
        result.isActive = input.isActive
      }
      return result
    },
    async getExamPapers(userId) {
      const db = createServiceRoleClient()
      const { data, error } = await db.from('user_profiles').select('exam_papers').eq('id', userId).single()
      if (error) throw new Error(`Could not load exam selections: ${error.message}`)
      return data.exam_papers ?? ['CS']
    },
    async updateExamPapers(userId, papers) {
      if (papers.length === 0 || papers.some(p => p !== 'CS' && p !== 'DA')) throw new Error('At least one supported exam paper is required')
      const db = createServiceRoleClient()
      const { error } = await db.from('user_profiles').update({ exam_papers: [...new Set(papers)] }).eq('id', userId)
      if (error) throw new Error(`Could not update exam selections: ${error.message}`)
    },
    async getPrivacySettings(userId) {
      const db = createServiceRoleClient()
      const { data, error } = await db.from('user_profiles')
        .select('profile_public,show_study_stats,allow_messages,show_analytics').eq('id', userId).single()
      if (error) throw new Error(`Could not load privacy settings: ${error.message}`)
      return { profilePublic: data.profile_public, showStudyStats: data.show_study_stats, allowMessages: data.allow_messages, showAnalytics: data.show_analytics }
    },
    async updatePrivacySettings(userId, settings) {
      const db = createServiceRoleClient()
      const { error } = await db.from('user_profiles').update({
        profile_public: settings.profilePublic, show_study_stats: settings.showStudyStats,
        allow_messages: settings.allowMessages, show_analytics: settings.showAnalytics,
      }).eq('id', userId)
      if (error) throw new Error(`Could not update privacy settings: ${error.message}`)
    },
    async list(filters = {}) {
      const db = createServiceRoleClient()
      let query = db.from('memberships').select('user_id,role,status,joined_at,user_profiles!inner(id,email,display_name,avatar_url,exam_papers,created_at)')
      if (filters.role) query = query.eq('role', filters.role)
      if (filters.isActive === true) query = query.eq('status', 'approved')
      else if (filters.isActive === false) query = query.neq('status', 'approved')
      if (filters.search) query = query.ilike('user_profiles.display_name', `%${filters.search.replace(/[%_]/g, '\\$&')}%`)
      query = query.order('created_at', { ascending: false }).range(Math.max(0, filters.offset ?? 0), Math.max(0, filters.offset ?? 0) + Math.min(200, Math.max(1, filters.limit ?? 50)) - 1)
      const { data, error } = await query
      if (error) throw new Error(`Could not list users: ${error.message}`)
      return (data ?? []).map((entry: any) => mapProfile({
        ...entry.user_profiles, role: entry.role, status: entry.status, joined_at: entry.joined_at,
      }))
    },
    async deactivate(userId) {
      const db = createServiceRoleClient()
      const userClient = await import('@/lib/server/supabase').then(module => module.createSupabaseClient())
      const { error } = await userClient.rpc('set_member_access', { p_user_id: userId, p_status: 'suspended', p_reason: 'Deactivated by administrator' })
      if (error) throw new Error(`Could not deactivate membership: ${error.message}`)
    },
    async reactivate(userId) {
      const db = createServiceRoleClient()
      const userClient = await import('@/lib/server/supabase').then(module => module.createSupabaseClient())
      const { error } = await userClient.rpc('set_member_access', { p_user_id: userId, p_status: 'approved', p_reason: null })
      if (error) throw new Error(`Could not reactivate membership: ${error.message}`)
    },
    async delete(userId) {
      const db = createServiceRoleClient()
      const { data, error } = await db.from('memberships').select('role').eq('user_id', userId).maybeSingle()
      if (error) throw new Error(`Could not load membership: ${error.message}`)
      if (data?.role === 'owner') throw new Error('The owner account cannot be deleted')
      const { error: deleteError } = await db.auth.admin.deleteUser(userId, false)
      if (deleteError) throw new Error(`Could not delete Auth user: ${deleteError.message}`)
    },
  }
}
