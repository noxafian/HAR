import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { AdminJoinRequestsClient } from '@/components/admin/admin-join-requests-client'
export default async function JoinRequestsPage() {
  const user = await getAuthenticatedUser()
  if (!user || user.role !== 'owner') redirect('/admin')
  return <AdminJoinRequestsClient/>
}
