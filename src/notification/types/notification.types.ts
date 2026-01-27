// src/notifications/types/notification.types.ts
import { Notification, User } from '@prisma/client';

export interface NotificationWithUser extends Notification {
  user?: Partial<User>;
}

export interface PaginatedNotifications {
  data: NotificationWithUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    unreadCount: number;
  };
}

export interface NotificationMetadata {
  courseId?: string;
  lessonId?: string;
  exerciseId?: string;
  commentId?: string;
  achievementId?: string;
  [key: string]: any;
}
