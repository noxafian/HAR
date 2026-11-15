import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
export default function RequestAccessPage() {
  return <Card><CardHeader><div className="mb-1 flex items-center gap-2"><Lock className="h-4 w-4 text-indigo-600"/><CardTitle>Request StudyHub Access</CardTitle></div><CardDescription>StudyHub uses authenticated membership requests so the owner can review an account without accepting unverified names or email addresses.</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Create an account, select the GATE paper(s) you are preparing for, and provide a short message for the owner. Your account will remain restricted until approved.</p><Link href="/register"><Button className="w-full">Create account and request access</Button></Link><p className="text-center text-sm text-muted-foreground">Already registered? <Link href="/login" className="font-medium text-indigo-600 hover:underline">Sign in to view your request</Link></p></CardContent></Card>
}
