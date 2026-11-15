import type { LoginInput, RegisterInput, AccessRequestInput } from '@/lib/validators/auth.schema'
import type { UserProfile } from '@/types/user'

export interface AuthResult {
  user: UserProfile
  sessionToken: string
}

/**
 * Authentication service interface.
 * Implementation: Phase B (Supabase Auth).
 */
export interface AuthService {
  login(credentials: LoginInput): Promise<AuthResult>
  register(data: RegisterInput): Promise<AuthResult>
  requestAccess(data: AccessRequestInput): Promise<void>
  logout(): Promise<void>
  getCurrentUser(): Promise<UserProfile | null>
  refreshSession(): Promise<AuthResult | null>
}
