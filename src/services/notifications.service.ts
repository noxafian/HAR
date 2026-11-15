import type { Notification } from '@/types/notifications'

/**
 * Notifications service interface.
 * Real-time notifications: Phase B.
 */
export interface NotificationsService {
  getNotifications(userId: string): Promise<Notification[]>
  markAsRead(notificationId: string): Promise<void>
  markAllAsRead(userId: string): Promise<void>
}
