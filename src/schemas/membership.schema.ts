import { z } from 'zod'

export const JoinRequestSchema = z.object({
  message: z.string().max(500).trim().optional(),
})

export const ApproveRequestSchema = z.object({
  role: z.enum(['member']).default('member'),
})

export const RejectRequestSchema = z.object({
  reason: z.string().max(500).trim().optional(),
})

export const UpdateMemberSchema = z.object({
  role: z.enum(['member']).optional(),
  action: z.enum(['suspend', 'reactivate', 'remove']).optional(),
  reason: z.string().max(500).trim().optional(),
}).refine(data => data.role || data.action, {
  message: 'Either role or action must be specified',
})

export type JoinRequestBody = z.infer<typeof JoinRequestSchema>
export type ApproveRequestBody = z.infer<typeof ApproveRequestSchema>
export type RejectRequestBody = z.infer<typeof RejectRequestSchema>
export type UpdateMemberBody = z.infer<typeof UpdateMemberSchema>
