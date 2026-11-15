import { redirect } from 'next/navigation'
import { getAuthenticatedUser } from '@/lib/server/auth'
import { AdminAuditClient } from '@/components/admin/admin-audit-client'
export default async function AuditLogPage() {
  const user = await getAuthenticatedUser()
  if (!user || user.role !== 'owner') redirect('/admin')
  return <AdminAuditClient/>
}
