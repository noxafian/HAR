'use client'

import { Menu, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiRequest } from '@/lib/client/api'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from './theme-toggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { ROUTE_PATHS } from '@/lib/constants'

interface AppHeaderProps {
  onMenuClick?: () => void
  pageTitle?: string
}

export function AppHeader({ onMenuClick, pageTitle }: AppHeaderProps) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  async function signOut() {
    setSigningOut(true)
    try { await apiRequest('/api/v1/auth/logout', { method: 'POST' }) }
    finally { router.replace('/login'); router.refresh(); setSigningOut(false) }
  }
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90">
      {onMenuClick && (
        <Button variant="ghost" size="icon" onClick={onMenuClick} aria-label="Toggle navigation menu" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {pageTitle && (
        <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 hidden md:block">{pageTitle}</h1>
      )}

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Open profile menu" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              <Avatar size="sm">
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Link href={ROUTE_PATHS.settingsProfile} className="w-full">Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link href={ROUTE_PATHS.settingsPrivacy} className="w-full">Privacy</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut()} disabled={signingOut}>
              <LogOut className="mr-2 h-4 w-4" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
