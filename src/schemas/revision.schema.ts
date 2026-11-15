import { z } from 'zod'

export const CreateFlashcardSchema = z.object({
  front: z.string().min(1).max(2000).trim(),
  back: z.string().min(1).max(2000).trim(),
  subject: z.string().max(100).trim().optional(),
  topic: z.string().max(100).trim().optional(),
  source: z.string().max(500).trim().optional(),
  isAiGenerated: z.boolean().optional().default(false),
  difficulty: z.number().int().min(1).max(5).optional().default(3),
})

export const UpdateFlashcardSchema = z.object({
  front: z.string().min(1).max(2000).trim().optional(),
  back: z.string().min(1).max(2000).trim().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  reviewResult: z.enum(['again', 'hard', 'good', 'easy']).optional(),
})

export const CreateMistakeSchema = z.object({
  questionId: z.string().uuid().optional(),
  questionText: z.string().min(10).max(5000).trim(),
  myAnswer: z.string().max(500).trim().optional().default(''),
  correctAnswer: z.string().max(500).trim().optional().default(''),
  subject: z.string().max(100).trim().optional(),
  topic: z.string().max(100).trim().optional(),
  notes: z.string().max(2000).trim().optional(),
  category: z.enum(['conceptual-misunderstanding', 'calculation-error', 'formula-forgotten', 'question-misunderstood', 'time-management', 'incorrect-guessing']).optional().default('conceptual-misunderstanding'),
})

export const UpdateMistakeSchema = z.object({
  notes: z.string().max(2000).trim().optional(),
  category: z.enum(['conceptual-misunderstanding', 'calculation-error', 'formula-forgotten', 'question-misunderstood', 'time-management', 'incorrect-guessing']).optional(),
  resolved: z.boolean().optional(),
})

export type CreateFlashcardBody = z.infer<typeof CreateFlashcardSchema>
export type UpdateFlashcardBody = z.infer<typeof UpdateFlashcardSchema>
export type CreateMistakeBody = z.infer<typeof CreateMistakeSchema>
export type UpdateMistakeBody = z.infer<typeof UpdateMistakeSchema>
