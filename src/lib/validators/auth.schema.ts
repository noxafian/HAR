import * as z from 'zod'

export const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
})

export const registerSchema = z
  .object({
    fullName: z.string().min(2, { message: 'Full name must be at least 2 characters.' }).max(64, { message: 'Full name must be 64 characters or fewer.' }),
    email: z.string().email({ message: 'Please enter a valid email address.' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters.' })
      .max(72, { message: 'Password must be 72 characters or fewer.' })
      .regex(/[A-Z]/, { message: 'Include at least one uppercase letter.' })
      .regex(/[0-9]/, { message: 'Include at least one number.' }),
    confirmPassword: z.string(),
    joinMessage: z.string().trim().max(500).optional(),
    examPapers: z
      .array(z.enum(['CS', 'DA']))
      .min(1, { message: 'Please select at least one examination paper.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

export const accessRequestSchema = z.object({
  fullName: z.string().min(2, { message: 'Full name must be at least 2 characters.' }).max(64, { message: 'Full name must be 64 characters or fewer.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  reason: z.string().trim().max(1000).optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type AccessRequestInput = z.infer<typeof accessRequestSchema>
