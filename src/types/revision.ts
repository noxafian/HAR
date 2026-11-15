export type RevisionStatus = 'not-started' | 'in-progress' | 'due' | 'overdue' | 'completed'

export type MistakeCategory =
  | 'conceptual-misunderstanding'
  | 'calculation-error'
  | 'formula-forgotten'
  | 'question-misunderstood'
  | 'time-management'
  | 'incorrect-guessing'

export interface RevisionItem {
  id: string
  userId: string
  topicId: string
  status: RevisionStatus
  scheduledDate: Date | null
  lastRevisedAt: Date | null
  revisionCount: number
}

export interface MistakeEntry {
  id: string
  userId: string
  questionId: string | null
  category: MistakeCategory
  note: string
  subjectId: string | null
  topicId: string | null
  createdAt: Date
}

export interface Flashcard {
  id: string
  userId: string
  front: string
  back: string
  topicId: string | null
  isRemembered: boolean
  isDifficult: boolean
  revisionStatus: RevisionStatus
  lastReviewedAt: Date | null
}
