'use client'

import { createContext } from 'react'
import type { UserRole } from '@/types/user'

export interface RoleContextValue {
  role: UserRole
  /** Phase A: simulated role switching for navigation preview only.
   *  Phase B: replaced with real auth session role. */
  setRole: (role: UserRole) => void
}

export const RoleContext = createContext<RoleContextValue>({
  role: 'member',
  setRole: () => {},
})
