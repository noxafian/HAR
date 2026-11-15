'use client'

import { useState } from 'react'
import { RoleContext } from './role-context'
import type { UserRole } from '@/types/user'

export function RoleProvider({ children, initialRole = 'member' }: {
  children: React.ReactNode
  initialRole?: UserRole
}) {
  const [role, setRole] = useState<UserRole>(initialRole)
  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  )
}
