import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { AdminMembersClient } from '@/components/admin/admin-members-client'
export default async function MembersPage() {
  const user = await getAuthenticatedUser()
  if (!user || user.role !== 'owner') redirect('/admin')
  return <AdminMembersClient currentUserId={user.id}/>
}
