'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import { useRole } from '@/hooks/use-role'
import { ROUTE_PATHS } from '@/lib/constants'
import {
  LayoutDashboard, Library, BookOpen, ClipboardList, GraduationCap,
  Brain, RotateCcw, BookMarked, AlertCircle, Calendar, Timer,
  BarChart2, Sparkles, Link2, Users, Settings, Shield, ChevronLeft,
  ChevronRight, Lightbulb, Dumbbell,
} from 'lucide-react'

interface NavItem { href: string; label: string; Icon: React.ElementType }

const mainNav: NavItem[] = [
  { href: ROUTE_PATHS.app, label: 'Dashboard', Icon: LayoutDashboard },
  { href: ROUTE_PATHS.library, label: 'Study Library', Icon: Library },
  { href: ROUTE_PATHS.pyq, label: 'PYQ Bank', Icon: BookOpen },
  { href: ROUTE_PATHS.practice, label: 'Practice', Icon: Dumbbell },
  { href: ROUTE_PATHS.mockTests, label: 'Mock Tests', Icon: ClipboardList },
]

const examNav: NavItem[] = [
  { href: ROUTE_PATHS.examCS, label: 'GATE CS 2027', Icon: GraduationCap },
  { href: ROUTE_PATHS.examDA, label: 'GATE DA 2027', Icon: Brain },
  { href: ROUTE_PATHS.examGA, label: 'General Aptitude', Icon: Lightbulb },
]

const personalNav: NavItem[] = [
  { href: ROUTE_PATHS.revision, label: 'Revision', Icon: RotateCcw },
  { href: ROUTE_PATHS.flashcards, label: 'Flashcards', Icon: BookMarked },
  { href: ROUTE_PATHS.mistakes, label: 'Mistakes', Icon: AlertCircle },
  { href: ROUTE_PATHS.planner, label: 'Planner', Icon: Calendar },
  { href: ROUTE_PATHS.focus, label: 'Focus Timer', Icon: Timer },
  { href: ROUTE_PATHS.analytics, label: 'Analytics', Icon: BarChart2 },
]

const aiNav: NavItem[] = [
  { href: ROUTE_PATHS.ai, label: 'AI Assistant', Icon: Sparkles },
  { href: ROUTE_PATHS.aiConnect, label: 'AI Connections', Icon: Link2 },
]

const communityNav: NavItem[] = [
  { href: ROUTE_PATHS.community, label: 'Community', Icon: Users },
]

const settingsNav: NavItem[] = [
  { href: ROUTE_PATHS.settingsProfile, label: 'Profile', Icon: Settings },
]

const adminNav: NavItem[] = [
  { href: ROUTE_PATHS.admin, label: 'Admin Dashboard', Icon: Shield },
]

interface SidebarSectionProps {
  label: string
  items: NavItem[]
  pathname: string
  collapsed: boolean
}

function SidebarSection({ label, items, pathname, collapsed }: SidebarSectionProps) {
  return (
    <div className="mb-4">
      {!collapsed && (
        <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {label}
        </p>
      )}
      <ul className="space-y-0.5">
        {items.map(({ href, label: itemLabel, Icon }) => {
          const isActive = pathname === href || (href !== ROUTE_PATHS.app && pathname.startsWith(href))
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                  collapsed && 'justify-center px-2',
                )}
                title={collapsed ? itemLabel : undefined}
                aria-label={collapsed ? itemLabel : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!collapsed && <span>{itemLabel}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

interface AppSidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname()
  const { role } = useRole()

  return (
    <aside
      className={cn(
        'relative flex h-full flex-col border-r border-slate-200 bg-white transition-all duration-200 dark:border-slate-700 dark:bg-slate-900',
        collapsed ? 'w-14' : 'w-60',
      )}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className={cn('flex h-14 items-center border-b border-slate-200 px-3 dark:border-slate-700', collapsed && 'justify-center')}>
        {!collapsed ? (
          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Keryvion StudyHub</span>
        ) : (
          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">KS</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <SidebarSection label="Main" items={mainNav} pathname={pathname} collapsed={collapsed} />
        <SidebarSection label="Exams" items={examNav} pathname={pathname} collapsed={collapsed} />
        <SidebarSection label="Personal" items={personalNav} pathname={pathname} collapsed={collapsed} />
        <SidebarSection label="AI" items={aiNav} pathname={pathname} collapsed={collapsed} />
        <SidebarSection label="Community" items={communityNav} pathname={pathname} collapsed={collapsed} />
        <SidebarSection label="Settings" items={settingsNav} pathname={pathname} collapsed={collapsed} />
        {/* Owner-only admin link — navigation display only, not a security boundary */}
        {role === 'owner' && (
          <SidebarSection label="Admin" items={adminNav} pathname={pathname} collapsed={collapsed} />
        )}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-16 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  )
}
