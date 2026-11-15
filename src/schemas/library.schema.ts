import { z } from 'zod'

const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'pptx', 'txt'] as const

export const RESOURCE_CATEGORIES = [
  { value: 'notes', label: 'Notes' },
  { value: 'year-wise-paper', label: 'Year-wise Papers' },
  { value: 'subject-wise-paper', label: 'Subject-wise Papers' },
  { value: 'topic-wise-paper', label: 'Topic-wise Papers' },
] as const

export type ResourceCategory = 'notes' | 'year-wise-paper' | 'subject-wise-paper' | 'topic-wise-paper'

export const UploadIntentSchema = z.object({
  fileName: z.string().min(1).max(255).trim(),
  fileSize: z.number().int().positive().max(52_428_800), // 50 MB
  contentType: z.string().max(128),
  title: z.string().min(1).max(255).trim(),
  description: z.string().max(2000).trim().optional(),
  subject: z.string().max(100).trim().optional(),
  topic: z.string().max(100).trim().optional(),
  paper: z.enum(['CS', 'DA', 'GA']).default('CS'),
  category: z.enum(['notes', 'year-wise-paper', 'subject-wise-paper', 'topic-wise-paper']).optional(),
})

export const ConfirmUploadSchema = z.object({
  fileHash: z.string().regex(/^[a-f0-9]{64}$/, 'Must be a SHA-256 hex string'),
})

export const UpdateResourceSchema = z.object({
  title: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(2000).trim().nullable().optional(),
  subject: z.string().max(100).trim().optional(),
  topic: z.string().max(100).trim().optional(),
})

export const ListResourcesQuerySchema = z.object({
  search: z.string().max(200).trim().optional(),
  subject: z.string().max(100).trim().optional(),
  paper: z.enum(['CS','DA','GA']).optional(),
  type: z.enum(ALLOWED_EXTENSIONS).optional(),
  category: z.enum(['notes', 'year-wise-paper', 'subject-wise-paper', 'topic-wise-paper']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export type UploadIntentBody = z.infer<typeof UploadIntentSchema>
export type ConfirmUploadBody = z.infer<typeof ConfirmUploadSchema>
export type UpdateResourceBody = z.infer<typeof UpdateResourceSchema>
export type ListResourcesQuery = z.infer<typeof ListResourcesQuerySchema>
