'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiRequest } from '@/lib/client/api'
import { Card } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { Users, UserCheck, FolderOpen, HardDrive, Shield, AlertCircle } from 'lucide-react'

type Summary = {
  members: { total: number; approved: number; pending: number; suspended: number }
  joinRequests: { pending: number; approved: number; rejected: number }
  resources: { total: number; pending: number; verified: number; bytesTracked: number }
}
const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(2)} ${units[index]}`
}

export function AdminDashboardClient() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { apiRequest<Summary>('/api/v1/admin/summary').then(setSummary).catch(e => setError(e instanceof Error ? e.message : 'Could not load admin summary')) }, [])
  const stats = [
    { label: 'Total Members', value: summary?.members.total, icon: Users },
    { label: 'Pending Requests', value: summary?.joinRequests.pending, icon: UserCheck },
    { label: 'Resources', value: summary?.resources.total, icon: FolderOpen },
    { label: 'Tracked Storage', value: summary ? formatBytes(summary.resources.bytesTracked) : undefined, icon: HardDrive },
  ]
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Admin Dashboard</h1><p className="mt-1 text-muted-foreground">Live workspace operations and moderation overview.</p></div>
    <Alert><Shield className="h-4 w-4"/><div><div className="font-semibold">Administrative access</div><div className="text-sm">Sensitive operations are authorized against the current database membership, not JWT role claims.</div></div></Alert>
    {error && <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"><AlertCircle className="mr-2 inline h-4 w-4"/>{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({label,value,icon:Icon}) => <Card key={label} className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value === undefined ? '—' : value}</p></div><Icon className="h-8 w-8 text-muted-foreground"/></div></Card>)}</div>
    {summary && <div className="grid gap-4 md:grid-cols-3"><Card className="p-5"><h2 className="font-semibold">Membership status</h2><div className="mt-3 space-y-1 text-sm"><p>Approved: <b>{summary.members.approved}</b></p><p>Pending: <b>{summary.members.pending}</b></p><p>Suspended: <b>{summary.members.suspended}</b></p></div></Card><Card className="p-5"><h2 className="font-semibold">Join request history</h2><div className="mt-3 space-y-1 text-sm"><p>Pending: <b>{summary.joinRequests.pending}</b></p><p>Approved: <b>{summary.joinRequests.approved}</b></p><p>Rejected: <b>{summary.joinRequests.rejected}</b></p></div></Card><Card className="p-5"><h2 className="font-semibold">Resource moderation</h2><div className="mt-3 space-y-1 text-sm"><p>Pending: <b>{summary.resources.pending}</b></p><p>Verified: <b>{summary.resources.verified}</b></p><p>Tracked bytes: <b>{formatBytes(summary.resources.bytesTracked)}</b></p></div></Card></div>}
    <Card className="p-6"><h2 className="mb-4 text-lg font-semibold">Quick actions</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
      ['/admin/join-requests','Review join requests',`${summary?.joinRequests.pending ?? '—'} pending`],
      ['/admin/members','Manage members',`${summary?.members.total ?? '—'} members`],
      ['/admin/resources','Review resources',`${summary?.resources.pending ?? '—'} awaiting moderation`],
      ['/admin/storage','Storage usage','Database-tracked files and sizes'],
      ['/admin/audit','Audit log','Recorded security and moderation events'],
      ['/admin/questions','Question Bank','Manage PYQ questions'],
      ['/admin/mock-studio','Mock Studio','Create and publish mock tests'],
      ['/admin/announcements','Announcements','Post and pin announcements'],
      ['/admin/community','Community Moderation','Review discussions and replies'],
      ['/admin/platform-analytics','Platform Analytics','User and content metrics'],
    ].map(([href,title,description]) => <Link key={href} href={href} className="rounded-lg border p-4 transition-colors hover:bg-accent"><div className="font-medium">{title}</div><div className="mt-1 text-sm text-muted-foreground">{description}</div></Link>)}</div></Card>
  </div>
}
