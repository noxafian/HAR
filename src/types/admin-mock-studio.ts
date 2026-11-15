import type { QuizQuestion } from '@/lib/server/ai-generator'

export interface AdminMockTest {
  id: string
  title: string
  paper: 'CS' | 'DA'
  duration_minutes: number
  total_questions: number | null
  total_marks: number | null
  status: 'draft' | 'published' | 'archived'
  is_available: boolean
  mode: string | null
  created_at: string
  updated_at: string
}

export interface MarkingConfig {
  id: string
  name: string
  paper: 'CS' | 'DA'
}

export interface AdminMockTestListResponse {
  items: AdminMockTest[]
  total: number
  marking_configs: MarkingConfig[]
}

export interface CreateMockTestBody {
  title: string
  paper: 'CS' | 'DA'
  duration_minutes: number
  mode?: string
  marking_config_id: string
}

export interface PatchMockTestBody {
  title?: string
  duration_minutes?: number
  status?: 'draft' | 'published' | 'archived'
  is_available?: boolean
  mode?: string
}

export interface AttachQuestionsBody {
  question_ids: string[]
}

export interface GenerateMockTestBody {
  topic: string
  subject_id: string
  subjectName: string
  count?: number
}

export interface GenerateMockTestResponse {
  items: QuizQuestion[]
  provider: string
  model: string
  draft: true
}
