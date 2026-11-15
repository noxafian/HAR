import { describe, it, expect } from 'vitest'
import { loginSchema, registerSchema, accessRequestSchema } from '@/lib/validators/auth.schema'
import { profileUpdateSchema } from '@/lib/validators/profile.schema'
import { resourceUploadSchema } from '@/lib/validators/resource.schema'

describe('Form Validation Schemas', () => {
  describe('loginSchema', () => {
    it('validates correct email and password', () => {
      const result = loginSchema.safeParse({
        email: 'student@keryvion.org',
        password: 'password123',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'invalid-email',
        password: 'password123',
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty password', () => {
      const result = loginSchema.safeParse({
        email: 'student@keryvion.org',
        password: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('registerSchema', () => {
    it('validates registration with valid fields and GATE CS paper', () => {
      const result = registerSchema.safeParse({
        fullName: 'Aakash Verma',
        email: 'aakash@example.com',
        password: 'securepassword123',
        confirmPassword: 'securepassword123',
        examPapers: ['CS'],
      })
      expect(result.success).toBe(true)
    })

    it('validates registration with both CS and DA papers', () => {
      const result = registerSchema.safeParse({
        fullName: 'Priya Sundaram',
        email: 'priya@example.com',
        password: 'securepassword123',
        confirmPassword: 'securepassword123',
        examPapers: ['CS', 'DA'],
      })
      expect(result.success).toBe(true)
    })

    it('rejects mismatched password and confirmPassword', () => {
      const result = registerSchema.safeParse({
        fullName: 'Test Student',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'differentpassword',
        examPapers: ['CS'],
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty examPapers selection', () => {
      const result = registerSchema.safeParse({
        fullName: 'Test Student',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        examPapers: [],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('accessRequestSchema', () => {
    it('accepts valid access application', () => {
      const result = accessRequestSchema.safeParse({
        fullName: 'Rohan Sharma',
        email: 'rohan@example.com',
        reason: 'Preparing for GATE 2027 CS track. Looking for rigorous peer study.',
      })
      expect(result.success).toBe(true)
    })

    it('rejects short reason (less than 20 chars)', () => {
      const result = accessRequestSchema.safeParse({
        fullName: 'Rohan Sharma',
        email: 'rohan@example.com',
        reason: 'Short reason',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('profileUpdateSchema', () => {
    it('validates profile update', () => {
      const result = profileUpdateSchema.safeParse({
        displayName: 'Devika Nair',
        examPapers: ['DA'],
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty exam papers on profile', () => {
      const result = profileUpdateSchema.safeParse({
        displayName: 'Devika Nair',
        examPapers: [],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('resourceUploadSchema', () => {
    it('validates complete resource metadata', () => {
      const result = resourceUploadSchema.safeParse({
        title: 'Complete Algorithms Notes - Asymptotic Notation',
        description: 'Comprehensive derivations and practice questions.',
        examPaper: 'CS',
        subjectId: 'cs-algorithms',
        topicId: 'asymptotic-notation',
        fileType: 'pdf',
        fileSizeBytes: 1048576, // 1 MB
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty title', () => {
      const result = resourceUploadSchema.safeParse({
        title: '',
        examPaper: 'CS',
        fileType: 'pdf',
        fileSizeBytes: 1024,
      })
      expect(result.success).toBe(false)
    })

    it('rejects file exceeding 50 MB limit', () => {
      const result = resourceUploadSchema.safeParse({
        title: 'Huge File',
        examPaper: 'CS',
        fileType: 'pdf',
        fileSizeBytes: 60 * 1024 * 1024, // 60 MB
      })
      expect(result.success).toBe(false)
    })
  })
})
