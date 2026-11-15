import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { AdminSidebar } from '@/components/layout/admin-sidebar'
import { AppHeader } from '@/components/layout/app-header'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')
  if (!user.isActive) redirect('/access-pending')
  if (user.role !== 'owner') redirect('/app')
  return <div className="flex h-screen overflow-hidden"><AdminSidebar/><div className="flex flex-1 flex-col overflow-hidden"><AppHeader/><main className="flex-1 overflow-y-auto p-6">{children}</main></div></div>
}
