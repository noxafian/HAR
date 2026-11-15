'use client'

import { createContext, useContext } from 'react'
import { cn } from '@/lib/cn'

interface RadioGroupContextValue { value: string; onChange: (v: string) => void }
const RadioGroupContext = createContext<RadioGroupContextValue>({ value: '', onChange: () => {} })

export function RadioGroup({ value, onValueChange, className, children }: {
  value: string
  onValueChange: (v: string) => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <RadioGroupContext.Provider value={{ value, onChange: onValueChange }}>
      <div role="radiogroup" className={cn('flex flex-col gap-2', className)}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}

export function RadioGroupItem({ value, id, label }: { value: string; id: string; label: string }) {
  const ctx = useContext(RadioGroupContext)
  const checked = ctx.value === value
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm" htmlFor={id}>
      <div
        role="radio"
        aria-checked={checked}
        id={id}
        tabIndex={0}
        onClick={() => ctx.onChange(value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') ctx.onChange(value) }}
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors',
          checked
            ? 'border-indigo-600 bg-indigo-600'
            : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800',
        )}
      >
        {checked && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
      </div>
      <span className="text-slate-700 dark:text-slate-300">{label}</span>
    </label>
  )
}
