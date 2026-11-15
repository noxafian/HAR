import { z } from 'zod'

export const StartSessionSchema = z.object({
  examId: z.string().uuid(),
})

export const SaveAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.union([
    z.string().max(500),              // MCQ: option letter or NAT value
    z.array(z.string().min(1).max(100)).max(100).refine(values => new Set(values).size === values.length, 'MSQ options must be unique'), // MSQ: unique option ids
    z.null(),                          // cleared answer
  ]),
  markedForReview: z.boolean().optional().default(false),
  clientTimestamp: z.string().datetime().optional(), // informational only, not trusted
})

export const SubmitExamSchema = z.object({
  sessionId: z.string().uuid(),
  // Final answer state — server validates against session answers
  finalAnswers: z.record(z.string().uuid(), z.union([
    z.string().max(500),
    z.array(z.string().max(100)),
    z.null(),
  ])).optional(),
  clientSubmittedAt: z.string().datetime().optional(), // informational only
})

export type StartSessionBody = z.infer<typeof StartSessionSchema>
export type SaveAnswerBody = z.infer<typeof SaveAnswerSchema>
export type SubmitExamBody = z.infer<typeof SubmitExamSchema>
