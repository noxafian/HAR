'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest, ApiClientError, jsonBody } from '@/lib/client/api'
import Link from 'next/link'
import { useForm } from '@/hooks/use-form'
import { registerSchema, type RegisterInput } from '@/lib/validators/auth.schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'

export default function RegisterPage() {
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)
  const { values, errors, isSubmitting, handleChange, setFieldValue, handleSubmit } = useForm<RegisterInput>({
    initialValues: { fullName: '', email: '', password: '', confirmPassword: '', examPapers: [], joinMessage: '' },
    schema: registerSchema,
    onSubmit: async () => {
      setNotice(null)
      try {
        const result = await apiRequest<{ user: { sessionReady: boolean; membershipStatus: string } }>('/api/v1/auth/register', { method: 'POST', body: jsonBody({ email: values.email, password: values.password, displayName: values.fullName, examPapers: values.examPapers, joinMessage: values.joinMessage }) })
        if (result.user.membershipStatus === 'approved') {
          router.replace('/login')
        } else if (result.user.sessionReady) {
          router.replace('/access-pending'); router.refresh()
        } else {
          setNotice('Your account was created. Check your email to confirm it, then sign in to view and submit your access request.')
        }
      } catch (error) { setNotice(error instanceof ApiClientError ? error.message : 'Registration failed. Please try again.') }
    },
  })

  function togglePaper(paper: 'CS' | 'DA') {
    const current = values.examPapers
    const next = current.includes(paper) ? current.filter(p => p !== paper) : [...current, paper]
    setFieldValue('examPapers', next)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Register to join Keryvion StudyHub.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {notice && <Alert variant="default" title="Registration status">{notice}</Alert>}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName" required>Full name</Label>
            <Input id="fullName" value={values.fullName} onChange={handleChange('fullName')} hasError={!!errors.fullName} placeholder="Your full name" autoComplete="name" />
            {errors.fullName && <p className="text-xs text-red-600">{errors.fullName}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" required>Email address</Label>
            <Input id="email" type="email" value={values.email} onChange={handleChange('email')} hasError={!!errors.email} placeholder="you@example.com" autoComplete="email" />
            {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" required>Password</Label>
            <Input id="password" type="password" value={values.password} onChange={handleChange('password')} hasError={!!errors.password} placeholder="At least 8 characters" autoComplete="new-password" />
            {errors.password && <p className="text-xs text-red-600">{errors.password}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword" required>Confirm password</Label>
            <Input id="confirmPassword" type="password" value={values.confirmPassword} onChange={handleChange('confirmPassword')} hasError={!!errors.confirmPassword} placeholder="Repeat password" autoComplete="new-password" />
            {errors.confirmPassword && <p className="text-xs text-red-600">{errors.confirmPassword}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="joinMessage">Why would you like to join? <span className="text-slate-400 text-xs font-normal">(optional)</span></Label>
            <Textarea id="joinMessage" value={values.joinMessage} onChange={handleChange('joinMessage')} hasError={!!errors.joinMessage} placeholder="Tell the owner about your GATE preparation goals…" rows={3} maxLength={500} />
            {errors.joinMessage && <p className="text-xs text-red-600">{errors.joinMessage}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label required>GATE examination paper</Label>
            <p className="text-xs text-slate-500">Select the paper(s) you are preparing for.</p>
            <div className="flex gap-4">
              <Checkbox
                id="paper-cs"
                label="CS — Computer Science"
                checked={values.examPapers.includes('CS')}
                onChange={() => togglePaper('CS')}
              />
              <Checkbox
                id="paper-da"
                label="DA — Data Science & AI"
                checked={values.examPapers.includes('DA')}
                onChange={() => togglePaper('DA')}
              />
            </div>
            {errors.examPapers && <p className="text-xs text-red-600">{errors.examPapers}</p>}
          </div>

          <Button type="submit" isLoading={isSubmitting} className="w-full">Create account</Button>
          <p className="text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
