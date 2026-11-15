import { z } from 'zod'

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(2).max(64).trim().optional(),
  avatarUrl: z.string().url().max(512).nullable().optional(),
  examPapers: z.array(z.enum(['CS', 'DA'])).min(1).max(2).optional(),
})

export const UpdatePrivacySettingsSchema = z.object({
  profilePublic: z.boolean().optional(),
  showStudyStats: z.boolean().optional(),
  allowMessages: z.boolean().optional(),
  showAnalytics: z.boolean().optional(),
})

export type UpdateProfileBody = z.infer<typeof UpdateProfileSchema>
export type UpdatePrivacySettingsBody = z.infer<typeof UpdatePrivacySettingsSchema>
