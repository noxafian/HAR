import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { RoleProvider } from '@/contexts/role-provider'
import { useRole } from '@/hooks/use-role'
import { AppSidebar } from '@/components/layout/app-sidebar'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/app',
}))

function TestRoleConsumer() {
  const { role, setRole } = useRole()
  return (
    <div>
      <span data-testid="current-role">{role}</span>
      <button onClick={() => setRole('owner')}>Switch to Owner</button>
      <button onClick={() => setRole('member')}>Switch to Member</button>
    </div>
  )
}

describe('Role Context & Role-Dependent Navigation', () => {
  it('defaults to member role and toggles correctly', () => {
    render(
      <RoleProvider initialRole="member">
        <TestRoleConsumer />
      </RoleProvider>
    )

    expect(screen.getByTestId('current-role').textContent).toBe('member')

    act(() => {
      screen.getByText('Switch to Owner').click()
    })
    expect(screen.getByTestId('current-role').textContent).toBe('owner')

    act(() => {
      screen.getByText('Switch to Member').click()
    })
    expect(screen.getByTestId('current-role').textContent).toBe('member')
  })

  it('hides Admin section for ordinary member', () => {
    render(
      <RoleProvider initialRole="member">
        <AppSidebar collapsed={false} onToggle={() => {}} />
      </RoleProvider>
    )

    expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('GATE CS 2027')).toBeInTheDocument()
    expect(screen.getByText('GATE DA 2027')).toBeInTheDocument()
  })

  it('displays Admin section for Owner without separate account', () => {
    render(
      <RoleProvider initialRole="owner">
        <AppSidebar collapsed={false} onToggle={() => {}} />
      </RoleProvider>
    )

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
    // Owner also has all student links
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('GATE CS 2027')).toBeInTheDocument()
    expect(screen.getByText('GATE DA 2027')).toBeInTheDocument()
  })
})

