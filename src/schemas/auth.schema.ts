import { z } from 'zod'

export const RegisterRequestSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password too long')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  displayName: z.string().min(2).max(64).trim(),
  joinMessage: z.string().trim().max(500).optional(),
  examPapers: z
    .array(z.enum(['CS', 'DA']))
    .min(1, 'Select at least one exam paper')
    .max(2)
    .optional()
    .default(['CS']),
})

export const LoginRequestSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(72),
})

export const BootstrapOwnerRequestSchema = z.object({
  email: z.string().email().max(254),
  bootstrapSecret: z.string().min(16, 'Bootstrap secret must be at least 16 characters'),
})

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>
export type LoginRequest = z.infer<typeof LoginRequestSchema>
export type BootstrapOwnerRequest = z.infer<typeof BootstrapOwnerRequestSchema>
