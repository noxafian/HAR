import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/contexts/theme-provider'
import { RoleProvider } from '@/contexts/role-provider'
import { ToastProvider } from '@/components/ui/toast'

export const metadata: Metadata = {
  title: 'Keryvion StudyHub — GATE 2027 Preparation',
  description: 'A private, invitation-controlled collaborative learning platform for GATE CS and DA preparation.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased font-sans" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <RoleProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </RoleProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
