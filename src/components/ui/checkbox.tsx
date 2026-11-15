'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/cn'
import { Check } from 'lucide-react'

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm" htmlFor={id}>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className="sr-only"
          {...props}
        />
        <div
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded border-2 transition-colors',
            props.checked
              ? 'border-indigo-600 bg-indigo-600'
              : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800',
            className,
          )}
        >
          {props.checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
        </div>
      </div>
      {label && <span className="text-slate-700 dark:text-slate-300">{label}</span>}
    </label>
  )
)
Checkbox.displayName = 'Checkbox'
