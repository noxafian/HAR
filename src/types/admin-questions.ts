export type QuestionSection = 'CS' | 'DA' | 'GA'
export type QuestionType = 'MCQ' | 'MSQ' | 'NAT'
export type ContentCategory = 'official-pyq' | 'member-contributed' | 'ai-generated' | 'unverified'
export type QuestionDifficulty = 'easy' | 'medium' | 'hard'

export interface QuestionOption {
  key: 'A' | 'B' | 'C' | 'D'
  value: string
}

export interface AdminQuestion {
  id: string
  type: QuestionType
  category: ContentCategory
  section: QuestionSection
  year: number | null
  subject_id: string | null
  topic_id: string | null
  prompt: string
  options: QuestionOption[] | null
  marks: 1 | 2
  difficulty: QuestionDifficulty | null
  source_ref: string | null
  is_verified: boolean
  explanation: string | null
  created_at: string
  updated_at: string
}

export interface AdminQuestionListResponse {
  items: AdminQuestion[]
  total: number
  limit: number
  offset: number
}

export interface CreateQuestionBody {
  type: QuestionType
  category: ContentCategory
  section: QuestionSection
  year?: number
  subject_id?: string
  topic_id?: string
  prompt: string
  options?: QuestionOption[]
  marks: 1 | 2
  difficulty?: QuestionDifficulty
  source_ref?: string
  explanation?: string
  correct_answer?: string
}

export type BulkUploadQuestionItem = CreateQuestionBody

export interface PatchQuestionBody {
  is_verified?: boolean
  explanation?: string
  difficulty?: QuestionDifficulty
  source_ref?: string
  prompt?: string
  marks?: 1 | 2
  year?: number
}
