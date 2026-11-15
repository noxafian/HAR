import type { ExamPaper } from './exam'

export type QuestionType = 'MCQ' | 'MSQ' | 'NAT'

/**
 * Content categories — must be visually distinct in UI.
 * official-pyq: from official GATE papers only.
 * member-contributed / ai-generated / unverified: must NOT appear as official.
 */
export type ContentCategory =
  | 'official-pyq'
  | 'member-contributed'
  | 'ai-generated'
  | 'unverified'

export interface MCQOption {
  id: string
  text: string
}

export interface Question {
  id: string
  type: QuestionType
  category: ContentCategory
  text: string
  options: MCQOption[] | null  // null for NAT
  correctOptionIds: string[] | null  // null for NAT
  natAnswer: number | null  // only for NAT
  year: number | null
  paper: ExamPaper
  subjectId: string | null
  topicId: string | null
  marks: number
  negativeMarks: number
  difficulty: 'easy' | 'medium' | 'hard' | null
  sourceReference: string | null
  solution: string | null
  isVerified: boolean
}
