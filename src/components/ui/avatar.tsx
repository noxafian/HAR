import { cn } from '@/lib/cn'

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'default' | 'lg'
}

export function Avatar({ className, size = 'default', ...props }: AvatarProps) {
  const sizes = { sm: 'h-8 w-8 text-xs', default: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-base' }
  return (
    <div className={cn('relative flex shrink-0 overflow-hidden rounded-full', sizes[size], className)} {...props} />
  )
}

export function AvatarImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={cn('h-full w-full object-cover', className)} />
}

export function AvatarFallback({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex h-full w-full items-center justify-center rounded-full bg-indigo-100 font-medium text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300', className)}
      {...props}
    />
  )
}
