'use client'

import { useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

export function useLocalPreferences() {
  // Initialize from localStorage (SSR-safe)
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'system';
    }
    return 'system';
  })

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('theme', t)
  }

  return { theme, setTheme }
}
