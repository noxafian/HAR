'use client'

import { useContext } from 'react'
import { RoleContext } from '@/contexts/role-context'

/**
 * Returns the current user's role from context.
 * Navigation only — not a security boundary.
 * Phase B enforces real server-side authorisation.
 */
export function useRole() {
  return useContext(RoleContext)
}
