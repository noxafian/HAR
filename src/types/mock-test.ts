import type { ExamPaper } from './exam'

export type QuestionStatus =
  | 'not-answered'
  | 'answered'
  | 'marked-for-review'
  | 'answered-and-marked'

export interface MockTest {
  id: string
  title: string
  paper: ExamPaper
  durationMinutes: number
  totalQuestions: number
  totalMarks: number | null
  isAvailable: boolean
  scheduledAt: Date | null
}

export interface TestAttempt {
  id: string
  testId: string
  userId: string
  startedAt: Date
  submittedAt: Date | null
  /** Score is null until officially calculated by backend */
  score: null
  questionStatuses: Record<string, QuestionStatus>
  answers: Record<string, string | string[] | number | null>
}

export interface ExamTimer {
  /**
   * Provided by server once exam session is started.
   * null in Phase A — timer is server-authoritative, not client-only.
   */
  serverRemainingSeconds: number | null
}
