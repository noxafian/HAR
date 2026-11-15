import type { MistakeCategory } from './revision'

export interface SubjectProgress {
  subjectId: string
  subjectName: string
  topicsTotal: number
  topicsCompleted: number | null
  pyqAttempted: number | null
  pyqAccuracy: number | null
}

export interface WeakTopic {
  topicId: string
  topicName: string
  subjectId: string
  accuracyPercent: number | null
  attemptCount: number
}

export interface MockTestSummary {
  testId: string
  attemptedAt: Date
  paper: string
  score: null // always null — calculated by backend
  totalMarks: number | null
}

export interface AnalyticsSummary {
  userId: string
  syllabusCoverage: number | null
  pyqAccuracy: number | null
  mockTestHistory: MockTestSummary[]
  subjectProgress: SubjectProgress[]
  weakTopics: WeakTopic[]
  mistakeBreakdown: Record<MistakeCategory, number> | null
  studyStreakDays: number | null
  totalStudyMinutes: number | null
}
