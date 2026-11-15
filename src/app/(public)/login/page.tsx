'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest, ApiClientError, jsonBody } from '@/lib/client/api'
import Link from 'next/link'
import { useForm } from '@/hooks/use-form'
import { loginSchema, type LoginInput } from '@/lib/validators/auth.schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'

export default function LoginPage() {
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)
  const { values, errors, isSubmitting, handleChange, handleSubmit } = useForm<LoginInput>({
    initialValues: { email: '', password: '' },
    schema: loginSchema,
    onSubmit: async () => {
      setNotice(null)
      try {
        const result = await apiRequest<{ user: { membershipStatus: string; role: string } }>('/api/v1/auth/login', { method: 'POST', body: jsonBody({ email: values.email, password: values.password }) })
        const { role, membershipStatus } = result.user
        if (role === 'owner') {
          router.replace('/admin')
        } else if (membershipStatus === 'approved') {
          router.replace('/app')
        } else {
          router.replace('/access-pending')
        }
        router.refresh()
      } catch (error) {
        setNotice(error instanceof ApiClientError ? error.message : 'Sign in failed. Please try again.')
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Enter your credentials to access your study workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {notice && <Alert variant="destructive" title="Sign in failed">{notice}</Alert>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" required>Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={handleChange('email')}
              hasError={!!errors.email}
              placeholder="you@example.com"
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && <p id="email-error" className="text-xs text-red-600">{errors.email}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" required>Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={values.password}
              onChange={handleChange('password')}
              hasError={!!errors.password}
              placeholder="••••••••"
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
            {errors.password && <p id="password-error" className="text-xs text-red-600">{errors.password}</p>}
          </div>
          <Button type="submit" isLoading={isSubmitting} className="w-full">
            Sign in
          </Button>
          <p className="text-center text-sm text-slate-500">
            No account?{' '}
            <Link href="/register" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">Register</Link>
            {' · '}
            <Link href="/request-access" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">Request access</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
