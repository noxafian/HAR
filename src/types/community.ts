export type DiscussionCategory =
  | 'doubt'
  | 'resource-recommendation'
  | 'question-of-the-day'
  | 'weekly-challenge'
  | 'general'

export interface Reply {
  id: string
  discussionId: string
  authorId: string
  authorName: string
  content: string
  createdAt: Date
  updatedAt: Date | null
  isEdited: boolean
}

export interface Discussion {
  id: string
  title: string
  content: string
  category: DiscussionCategory
  authorId: string
  authorName: string
  createdAt: Date
  updatedAt: Date | null
  replyCount: number
  subjectId: string | null
  topicId: string | null
  isPinned: boolean
}

export interface Announcement {
  id: string
  title: string
  content: string
  authorId: string
  authorName: string
  createdAt: Date
  isPinned: boolean
  expiresAt: Date | null
}
