import * as z from 'zod'

export const profileUpdateSchema = z.object({
  displayName: z
    .string()
    .min(2, { message: 'Display name must be at least 2 characters.' })
    .max(100),
  examPapers: z
    .array(z.enum(['CS', 'DA']))
    .min(1, { message: 'Please select at least one examination paper.' }),
})

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
