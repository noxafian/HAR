import { cn } from '@/lib/cn'
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react'

export type AlertVariant = 'default' | 'destructive' | 'success' | 'warning'

const variantConfig: Record<AlertVariant, { classes: string; Icon: React.ElementType }> = {
  default: { classes: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100', Icon: Info },
  destructive: { classes: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-100', Icon: AlertCircle },
  success: { classes: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950 dark:border-green-800 dark:text-green-100', Icon: CheckCircle2 },
  warning: { classes: 'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-100', Icon: AlertTriangle },
}

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant
  title?: string
}

export function Alert({ variant = 'default', title, className, children, ...props }: AlertProps) {
  const { classes, Icon } = variantConfig[variant]
  return (
    <div
      role="alert"
      className={cn('flex gap-3 rounded-lg border p-4 text-sm', classes, className)}
      {...props}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        {title && <p className="font-semibold mb-1">{title}</p>}
        {children}
      </div>
    </div>
  )
}
