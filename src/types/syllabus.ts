import type { ExamPaper } from './exam'

export interface SyllabusVersion {
  version: string
  paper: ExamPaper
  year: number
  source: string
}

export interface Subject {
  id: string
  name: string
  paper: ExamPaper
  order: number
}

export interface Topic {
  id: string
  subjectId: string
  name: string
  parentTopicId: string | null
  order: number
}

export interface TopicProgress {
  topicId: string
  userId: string
  completionPercent: number | null
  lastStudiedAt: Date | null
  revisionCount: number
}
