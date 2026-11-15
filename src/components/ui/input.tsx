import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm',
        'text-slate-900 placeholder:text-slate-400',
        'dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        hasError
          ? 'border-red-500 focus-visible:ring-red-500'
          : 'border-slate-300 dark:border-slate-600',
        className,
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'
