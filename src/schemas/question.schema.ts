import { z } from 'zod'

export const SubmitQuestionSchema = z.object({
  prompt: z.string().min(10).max(5000).trim(),
  type: z.enum(['MCQ', 'MSQ', 'NAT']),
  // MCQ/MSQ options
  options: z.array(z.string().min(1).max(500)).min(2).max(6).optional(),
  // Official answer key
  correctAnswer: z.union([z.string(), z.array(z.string()), z.number()]).optional(),
  explanation: z.string().max(5000).trim().optional(),
  subject: z.string().max(100).trim().optional(),
  topic: z.string().max(100).trim().optional(),
  paper: z.enum(['CS', 'DA', 'GA']).optional(),
  year: z.number().int().min(2000).max(2030).optional(),
  // GATE questions are one or two marks; the database enforces the same rule.
  marks: z.union([z.literal(1), z.literal(2)]).optional(),
  negativeMarks: z.number().min(0).max(5).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  // Category — never auto-promoted
  category: z.enum(['member-contributed', 'ai-generated']),
  sourceRef: z.string().max(500).trim().optional(),
})

export const ReportQuestionSchema = z.object({
  reason: z.enum(['wrong-answer', 'wrong-explanation', 'outdated', 'duplicate', 'other']),
  details: z.string().max(1000).trim().optional(),
})

export const QuestionListQuerySchema = z.object({
  search: z.string().max(200).trim().optional(),
  paper: z.enum(['CS', 'DA', 'GA']).optional(),
  type: z.enum(['MCQ', 'MSQ', 'NAT']).optional(),
  category: z.enum(['official-pyq', 'member-contributed', 'ai-generated', 'unverified']).optional(),
  subject: z.string().max(100).trim().optional(),
  topic: z.string().max(100).trim().optional(),
  year: z.coerce.number().int().min(2000).max(2030).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export type SubmitQuestionBody = z.infer<typeof SubmitQuestionSchema>
export type ReportQuestionBody = z.infer<typeof ReportQuestionSchema>
export type QuestionListQuery = z.infer<typeof QuestionListQuerySchema>
