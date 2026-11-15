import type { UserProfile } from '@/types/user'
import type { ProfileUpdateInput } from '@/lib/validators/profile.schema'

/**
 * User profile service interface.
 * Implementation: Phase B.
 */
export interface UserService {
  getProfile(userId: string): Promise<UserProfile>
  updateProfile(userId: string, data: ProfileUpdateInput): Promise<UserProfile>
  getAvatarUploadUrl(userId: string): Promise<string>
}
