import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { AppShell } from '@/components/layout/app-shell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')
  if (!user.isActive) redirect('/access-pending')
  return <AppShell>{children}</AppShell>
}
