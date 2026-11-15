/**
 * src/test/auth.routes.test.ts
 * Route handler tests for Authentication APIs:
 * - /api/v1/auth/register
 * - /api/v1/auth/login
 * - /api/v1/auth/logout
 * - /api/v1/auth/session
 */

import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { RegisterRequestSchema, LoginRequestSchema } from '@/schemas/auth.schema'

// Mock next/headers for isolated route handler unit testing
vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => {},
    delete: () => {},
  }),
}))

import { POST as registerHandler } from '@/app/api/v1/auth/register/route'
import { POST as loginHandler } from '@/app/api/v1/auth/login/route'
import { POST as logoutHandler } from '@/app/api/v1/auth/logout/route'
import { GET as sessionHandler } from '@/app/api/v1/auth/session/route'
import { POST as refreshHandler } from '@/app/api/v1/auth/refresh/route'
import { POST as bootstrapHandler } from '@/app/api/v1/admin/bootstrap/route'

describe('Authentication Route Handlers & Contracts', () => {
  describe('Zod Validation: RegisterRequestSchema', () => {
    it('accepts valid registration payload', () => {
      const valid = {
        email: 'aspirant@keryvion.internal',
        password: 'Password123!',
        displayName: 'Aspirant One',
        examPapers: ['CS', 'DA'],
      }
      const result = RegisterRequestSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('rejects password without uppercase letter or number', () => {
      const invalid = {
        email: 'test@keryvion.internal',
        password: 'lowercaseonly',
        displayName: 'Test User',
      }
      const result = RegisterRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('rejects invalid email format', () => {
      const invalid = {
        email: 'not-an-email',
        password: 'Password123!',
        displayName: 'Test User',
      }
      const result = RegisterRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('Zod Validation: LoginRequestSchema', () => {
    it('accepts valid login payload', () => {
      const valid = {
        email: 'student@keryvion.internal',
        password: 'SecurePassword123',
      }
      const result = LoginRequestSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('rejects empty password', () => {
      const invalid = {
        email: 'student@keryvion.internal',
        password: '',
      }
      const result = LoginRequestSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('POST /api/v1/auth/register Handler', () => {
    it('returns 400 when request body is not valid JSON', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        body: 'invalid-non-json-string',
      })

      const res = await registerHandler(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      const errorId = data.error?.errorId || data.errorId
      expect(errorId).toBe('INVALID_REQUEST')
    })

    it('returns 400 when required fields fail schema validation', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid-email',
          password: 'short',
        }),
      })

      const res = await registerHandler(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      const errorId = data.error?.errorId || data.errorId
      expect(errorId).toBe('VALIDATION_FAILED')
    })
  })

  describe('POST /api/v1/auth/login Handler', () => {
    it('returns 400 when login request body is malformed JSON', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        body: 'bad-json',
      })

      const res = await loginHandler(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      const errorId = data.error?.errorId || data.errorId
      expect(errorId).toBe('INVALID_REQUEST')
    })

    it('returns 400 when email or password format is invalid', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'not-valid-email',
          password: '',
        }),
      })

      const res = await loginHandler(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      const errorId = data.error?.errorId || data.errorId
      expect(errorId).toBe('VALIDATION_FAILED')
    })
  })

  describe('GET /api/v1/auth/session Handler', () => {
    it('returns 401 when no active user session exists', async () => {
      const res = await sessionHandler()
      expect(res.status).toBe(401)
      const data = await res.json()
      const errorId = data.error?.errorId || data.errorId
      expect(errorId).toBe('UNAUTHENTICATED')
    })
  })

  describe('POST /api/v1/auth/logout Handler', () => {
    it('returns 200 on logout', async () => {
      const res = await logoutHandler()
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Logged out successfully')
    })
  })

  describe('POST /api/v1/auth/refresh Handler', () => {
    it('returns 401 when no active session exists to refresh', async () => {
      const res = await refreshHandler()
      expect(res.status).toBe(401)
      const data = await res.json()
      const errorId = data.error?.errorId || data.errorId
      expect(errorId).toBe('UNAUTHENTICATED')
    })
  })

  describe('POST /api/v1/admin/bootstrap Handler', () => {
    it('returns 403 when ADMIN_BOOTSTRAP_SECRET is not configured or too short', async () => {
      const original = process.env.ADMIN_BOOTSTRAP_SECRET
      delete process.env.ADMIN_BOOTSTRAP_SECRET

      const req = new NextRequest('http://localhost:3000/api/v1/admin/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'first-admin@keryvion.internal',
          bootstrapSecret: 'ValidSecret123456789!',
        }),
      })

      const res = await bootstrapHandler(req)
      expect(res.status).toBe(403)
      const data = await res.json()
      const errorId = data.error?.errorId || data.errorId
      expect(errorId).toBe('INSUFFICIENT_PERMISSIONS')

      if (original) process.env.ADMIN_BOOTSTRAP_SECRET = original
    })

    it('returns 403 when wrong bootstrap secret is provided', async () => {
      process.env.ADMIN_BOOTSTRAP_SECRET = 'CorrectSuperSecretKey123!'

      const req = new NextRequest('http://localhost:3000/api/v1/admin/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'first-admin@keryvion.internal',
          bootstrapSecret: 'WrongSecretProvided123!',
        }),
      })

      const res = await bootstrapHandler(req)
      expect(res.status).toBe(403)
      const data = await res.json()
      const errorId = data.error?.errorId || data.errorId
      expect(errorId).toBe('INSUFFICIENT_PERMISSIONS')
    })
  })
})
