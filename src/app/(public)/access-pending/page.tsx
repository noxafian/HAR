import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { AccessPendingClient } from '@/components/admin/access-pending-client'
export default async function AccessPendingPage() {
  const user = await getAuthenticatedUser()
  if (!user) redirect('/login')
  if (user.isActive) redirect('/app')
  if (user.membershipStatus === 'suspended') redirect('/login?reason=suspended')
  return <AccessPendingClient status={user.membershipStatus ?? 'pending'} displayName={user.displayName}/>
}
