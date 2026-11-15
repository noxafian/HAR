'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function Tooltip({ children }: { children: React.ReactNode }) {
  return <div className="relative inline-flex">{children}</div>
}

export function TooltipTrigger({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function TooltipContent({ content, side = 'top', className }: {
  content: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}) {
  const positionClass = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  }[side]
  return (
    <div className={cn(
      'pointer-events-none absolute z-50 hidden rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:block dark:bg-slate-700',
      positionClass,
      className,
    )}>
      {content}
    </div>
  )
}

/** Simple tooltip wrapper: wraps trigger in a group, shows tooltip on hover */
export function WithTooltip({ children, tip, side = 'top' }: {
  children: React.ReactNode
  tip: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}) {
  const [show, setShow] = useState(false)
  const positionClass = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  }[side]
  return (
    <div className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <div className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white dark:bg-slate-700',
          positionClass,
        )}>
          {tip}
        </div>
      )}
    </div>
  )
}
