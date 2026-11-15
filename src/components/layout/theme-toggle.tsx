'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/contexts/theme-provider'
import { Button } from '@/components/ui/button'
import type { Theme } from '@/hooks/use-local-preferences'

const themes: { value: Theme; label: string; Icon: React.ElementType }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Always render a stable placeholder until client mounts to avoid hydration mismatch
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Theme toggle" disabled>
        <Monitor className="h-4 w-4" />
      </Button>
    )
  }

  const current = themes.find((t) => t.value === theme) ?? themes[2]
  const next = themes[(themes.indexOf(current) + 1) % themes.length]
  const { Icon } = current
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next.value)}
      aria-label={`Switch to ${next.label} theme (currently ${current.label})`}
      title={`Switch to ${next.label} theme`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}
