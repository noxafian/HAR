import Link from 'next/link'
import { XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AccessDeniedPage() {
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
            <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
        </div>
        <CardTitle className="text-center">Access Denied</CardTitle>
        <CardDescription className="text-center">
          Your access request was not approved.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Unfortunately your request to join Keryvion StudyHub was not approved at this time.
          This may be because membership is currently full or the platform is in a restricted phase.
        </p>
        <p className="text-sm text-slate-500">
          If you believe this is an error, please contact the platform owner directly.
        </p>
        <Link href="/request-access">
          <Button variant="outline" className="w-full">Submit a new request</Button>
        </Link>
      </CardContent>
    </Card>
  )
}
