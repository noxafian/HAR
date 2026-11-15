import type { Question, QuestionType, ContentCategory } from '@/types/question'
import type { ExamPaper } from '@/types/exam'

export interface QuestionFilters {
  type?: QuestionType
  category?: ContentCategory
  year?: number
  paper?: ExamPaper
  subjectId?: string
  topicId?: string
  difficulty?: Question['difficulty']
}

/**
 * Question bank service interface.
 * Implementation: Phase B.
 */
export interface QuestionService {
  getQuestions(filters?: QuestionFilters): Promise<Question[]>
  getQuestion(id: string): Promise<Question>
  contributeQuestion(question: Omit<Question, 'id' | 'isVerified'>): Promise<Question>
}
