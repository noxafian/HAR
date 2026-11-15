import { z } from 'zod'

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  description: z.string().max(1000).trim().optional(),
  subject: z.string().max(100).trim().optional(),
  topic: z.string().max(100).trim().optional(),
  scheduledDate: z.string().date(),
  estimatedMinutes: z.number().int().positive().max(480).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
})

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(1000).trim().nullable().optional(),
  scheduledDate: z.string().date().optional(),
  estimatedMinutes: z.number().int().positive().max(480).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  completed: z.boolean().optional(),
})

export const CreateFocusSessionSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  durationMinutes: z.number().int().positive().max(480),
  subject: z.string().max(100).trim().optional(),
  topic: z.string().max(100).trim().optional(),
  sessionType: z.enum(['focused', 'short-break', 'long-break']).default('focused'),
})

export type CreateTaskBody = z.infer<typeof CreateTaskSchema>
export type UpdateTaskBody = z.infer<typeof UpdateTaskSchema>
export type CreateFocusSessionBody = z.infer<typeof CreateFocusSessionSchema>
