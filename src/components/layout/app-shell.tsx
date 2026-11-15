'use client'

import { useState } from 'react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { MobileNav } from '@/components/layout/mobile-nav'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
    <div className="hidden flex-shrink-0 md:flex"><AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(value => !value)}/></div>
    <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)}/>
    <div className="flex flex-1 flex-col overflow-hidden"><AppHeader onMenuClick={() => setMobileNavOpen(true)}/><main className="flex-1 overflow-y-auto p-4 md:p-6" id="main-content">{children}</main></div>
  </div>
}
