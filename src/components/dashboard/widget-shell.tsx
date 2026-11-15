import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import type { LucideIcon } from 'lucide-react'

interface WidgetShellProps {
  title: string
  icon: LucideIcon
  emptyMessage: string
  isEmpty: boolean
  children?: React.ReactNode
}

export function WidgetShell({ title, icon: Icon, emptyMessage, isEmpty, children }: WidgetShellProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-indigo-500" aria-hidden="true" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <EmptyState title={emptyMessage} className="py-6" />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
