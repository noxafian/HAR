'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useRole } from '@/hooks/use-role'
import { ROUTE_PATHS } from '@/lib/constants'

const allLinks = [
  { href: ROUTE_PATHS.app, label: 'Dashboard' },
  { href: ROUTE_PATHS.library, label: 'Library' },
  { href: ROUTE_PATHS.pyq, label: 'PYQ Bank' },
  { href: ROUTE_PATHS.practice, label: 'Practice' },
  { href: ROUTE_PATHS.mockTests, label: 'Mock Tests' },
  { href: ROUTE_PATHS.examCS, label: 'GATE CS 2027' },
  { href: ROUTE_PATHS.examDA, label: 'GATE DA 2027' },
  { href: ROUTE_PATHS.examGA, label: 'General Aptitude' },
  { href: ROUTE_PATHS.revision, label: 'Revision' },
  { href: ROUTE_PATHS.flashcards, label: 'Flashcards' },
  { href: ROUTE_PATHS.mistakes, label: 'Mistakes' },
  { href: ROUTE_PATHS.planner, label: 'Planner' },
  { href: ROUTE_PATHS.focus, label: 'Focus Timer' },
  { href: ROUTE_PATHS.analytics, label: 'Analytics' },
  { href: ROUTE_PATHS.ai, label: 'AI Assistant' },
  { href: ROUTE_PATHS.aiConnect, label: 'AI Connections' },
  { href: ROUTE_PATHS.community, label: 'Community' },
  { href: ROUTE_PATHS.settingsProfile, label: 'Profile Settings' },
]

interface MobileNavProps { isOpen: boolean; onClose: () => void }

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname()
  const { role } = useRole()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative flex h-full w-72 flex-col bg-white shadow-xl dark:bg-slate-900">
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
          <span className="font-bold text-indigo-600 dark:text-indigo-400">Keryvion StudyHub</span>
          <button onClick={onClose} aria-label="Close menu" className="rounded focus-visible:ring-2 focus-visible:ring-indigo-500">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-0.5">
            {allLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center rounded-md px-3 py-2.5 text-sm font-medium',
                    pathname === href || (href !== ROUTE_PATHS.app && pathname.startsWith(href))
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  {label}
                </Link>
              </li>
            ))}
            {role === 'owner' && (
              <li>
                <Link
                  href={ROUTE_PATHS.admin}
                  onClick={onClose}
                  className="flex items-center rounded-md px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Admin Dashboard
                </Link>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </div>
  )
}
