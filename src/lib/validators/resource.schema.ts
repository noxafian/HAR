import * as z from 'zod'
import { MAX_UPLOAD_SIZE_BYTES } from '@/lib/constants'

const ALLOWED_TYPES = ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'pptx', 'txt'] as const

export const resourceUploadSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }).max(200),
  description: z.string().max(1000).optional(),
  examPaper: z.enum(['CS', 'DA', 'GA']).optional(),
  subjectId: z.string().optional(),
  topicId: z.string().optional(),
  fileType: z.enum(ALLOWED_TYPES, {
    error: `File type must be one of: ${ALLOWED_TYPES.join(', ')}`,
  }),
  fileSizeBytes: z
    .number()
    .max(MAX_UPLOAD_SIZE_BYTES, {
      message: `File size must not exceed ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB.`,
    }),
})

export type ResourceUploadInput = z.infer<typeof resourceUploadSchema>
