'use client'

import { createContext, useContext, useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/cn'

interface DropdownContextValue { isOpen: boolean; setIsOpen: (v: boolean) => void }
const DropdownContext = createContext<DropdownContextValue>({ isOpen: false, setIsOpen: () => {} })

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen }}>
      <div ref={ref} className="relative">{children}</div>
    </DropdownContext.Provider>
  )
}

export function DropdownMenuTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const { setIsOpen, isOpen } = useContext(DropdownContext)
  if (asChild && isValidElement(children)) {
    return cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
      onClick: () => setIsOpen(!isOpen),
      'aria-expanded': isOpen,
      'aria-haspopup': 'true',
    })
  }
  return <span onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} aria-haspopup="true">{children}</span>
}

import { isValidElement, cloneElement } from 'react'

export function DropdownMenuContent({ className, children, align = 'end' }: {
  className?: string
  children: React.ReactNode
  align?: 'start' | 'end' | 'center'
}) {
  const { isOpen } = useContext(DropdownContext)
  if (!isOpen) return null
  const alignClass = align === 'end' ? 'right-0' : align === 'start' ? 'left-0' : 'left-1/2 -translate-x-1/2'
  return (
    <div
      role="menu"
      className={cn(
        'absolute top-full mt-1 z-50 min-w-[160px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-md dark:border-slate-700 dark:bg-slate-900',
        alignClass,
        className,
      )}
    >
      {children}
    </div>
  )
}

export function DropdownMenuItem({ className, onClick, children, disabled, ...props }: React.HTMLAttributes<HTMLButtonElement> & { disabled?: boolean }) {
  const { setIsOpen } = useContext(DropdownContext)
  return (
    <button
      role="menuitem"
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
        'focus-visible:outline-none focus-visible:bg-slate-100 dark:focus-visible:bg-slate-800',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      onClick={(e) => { if (!disabled) { setIsOpen(false); onClick?.(e) } }}
      {...props}
    >
      {children}
    </button>
  )
}

export function DropdownMenuSeparator() {
  return <hr className="my-1 border-slate-200 dark:border-slate-700" />
}

export function DropdownMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400', className)} {...props} />
}
