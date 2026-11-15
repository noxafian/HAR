'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import { ROUTE_PATHS } from '@/lib/constants'
import { LayoutDashboard, Users, UserPlus, FileText, HardDrive, ScrollText, ArrowLeft, BookOpen, FlaskConical, Megaphone, MessageSquare, BarChart2, MonitorPlay } from 'lucide-react'

const adminNav = [
  { href: ROUTE_PATHS.admin, label: 'Overview', Icon: LayoutDashboard },
  { href: ROUTE_PATHS.adminMembers, label: 'Members', Icon: Users },
  { href: ROUTE_PATHS.adminJoinRequests, label: 'Join Requests', Icon: UserPlus },
  { href: ROUTE_PATHS.adminResources, label: 'Resources', Icon: FileText },
  { href: ROUTE_PATHS.adminVideos, label: 'Videos', Icon: MonitorPlay },
  { href: ROUTE_PATHS.adminStorage, label: 'Storage', Icon: HardDrive },
  { href: ROUTE_PATHS.adminAudit, label: 'Audit Log', Icon: ScrollText },
  { href: ROUTE_PATHS.adminQuestions, label: 'Questions', Icon: BookOpen },
  { href: ROUTE_PATHS.adminMockStudio, label: 'Mock Studio', Icon: FlaskConical },
  { href: ROUTE_PATHS.adminAnnouncements, label: 'Announcements', Icon: Megaphone },
  { href: ROUTE_PATHS.adminCommunity, label: 'Community', Icon: MessageSquare },
  { href: ROUTE_PATHS.adminPlatformAnalytics, label: 'Analytics', Icon: BarChart2 },
]

export function AdminSidebar() {
  const pathname = usePathname()
  return (
    <aside className="flex h-full w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" aria-label="Admin navigation">
      <div className="flex h-14 items-center border-b border-slate-200 px-4 dark:border-slate-700">
        <span className="text-sm font-bold text-red-600 dark:text-red-400">Admin Panel</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Admin navigation">
        <ul className="space-y-0.5">
          {adminNav.map(({ href, label, Icon }) => {
            const isActive = pathname === href
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500',
                    isActive
                      ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="border-t border-slate-200 p-3 dark:border-slate-700">
        <Link
          href={ROUTE_PATHS.app}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Student Dashboard
        </Link>
      </div>
    </aside>
  )
}
