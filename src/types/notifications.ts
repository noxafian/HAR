export type NotificationType =
  | 'announcement'
  | 'join-request-approved'
  | 'join-request-rejected'
  | 'resource-verified'
  | 'discussion-reply'
  | 'revision-due'
  | 'test-available'
  | 'system'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  createdAt: Date
  linkUrl: string | null
}
