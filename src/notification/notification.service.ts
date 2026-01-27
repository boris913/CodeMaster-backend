// src/notifications/notification.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationFiltersDto } from './dto/notification-filters.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { Notification, NotificationType, Role, Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationMetadata } from './types/notification.types';

// Pagination meta interface (exported for the controller)
export interface PaginationMeta {
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Public method to create a notification
  async create(
    userId: string,
    createNotificationDto: CreateNotificationDto,
  ): Promise<NotificationResponseDto> {
    const metadata: Prisma.InputJsonValue = createNotificationDto.metadata
      ? (JSON.parse(
          JSON.stringify(createNotificationDto.metadata),
        ) as Prisma.InputJsonValue)
      : {};

    const notification = await this.prisma.notification.create({
      data: {
        type: createNotificationDto.type,
        title: createNotificationDto.title,
        message: createNotificationDto.message,
        userId,
        metadata,
      },
    });

    // Emit an event for WebSockets or other services
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.eventEmitter.emit('notification.created', {
      userId,
      notification,
    });

    return this.mapToNotificationResponseDto(notification);
  }

  // Method to create a system notification (for admins/instructors)
  async createSystemNotification(
    userIds: string[],
    title: string,
    message: string,
    metadata?: NotificationMetadata,
  ): Promise<void> {
    const metadataJson: Prisma.InputJsonValue = metadata
      ? (JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue)
      : {};

    const notifications = userIds.map((userId) => ({
      type: NotificationType.SYSTEM,
      title,
      message,
      userId,
      metadata: metadataJson,
    }));

    await this.prisma.notification.createMany({
      data: notifications,
    });

    // Emit an event for each user
    userIds.forEach((userId) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      this.eventEmitter.emit('notification.created', {
        userId,
        notification: {
          type: NotificationType.SYSTEM,
          title,
          message,
          metadata,
        },
      });
    });
  }

  // Find notifications for a user
  async findByUser(
    userId: string,
    filters: NotificationFiltersDto,
  ): Promise<{ data: NotificationResponseDto[]; meta: PaginationMeta }> {
    const where: Prisma.NotificationWhereInput = { userId };

    // Apply filters
    if (filters.unreadOnly) {
      where.isRead = false;
    }

    if (filters.type) {
      where.type = filters.type as NotificationType;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: ((filters.page ?? 1) - 1) * (filters.limit ?? 20),
        take: filters.limit ?? 20,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { ...where, isRead: false },
      }),
    ]);

    const notificationDtos = notifications.map((notification) =>
      this.mapToNotificationResponseDto(notification),
    );

    return {
      data: notificationDtos,
      meta: {
        total,
        unreadCount,
        page: filters.page ?? 1,
        limit: filters.limit ?? 20,
        totalPages: Math.ceil(total / (filters.limit ?? 20)),
      },
    };
  }

  // Retrieve a specific notification
  async findOne(id: string, userId: string): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Check if the user owns the notification
    if (notification.userId !== userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role !== Role.ADMIN) {
        throw new ForbiddenException(
          'You are not authorized to access this notification',
        );
      }
    }

    return this.mapToNotificationResponseDto(notification);
  }

  // Mark a notification as read
  async markAsRead(
    id: string,
    userId: string,
  ): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Check if the user owns the notification
    if (notification.userId !== userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role !== Role.ADMIN) {
        throw new ForbiddenException(
          'You are not authorized to modify this notification',
        );
      }
    }

    // If already read, return directly
    if (notification.isRead) {
      return this.mapToNotificationResponseDto(notification);
    }

    const updatedNotification = await this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return this.mapToNotificationResponseDto(updatedNotification);
  }

  // Mark all notifications as read
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  // Delete a notification
  async remove(id: string, userId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Check if the user owns the notification
    if (notification.userId !== userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role !== Role.ADMIN) {
        throw new ForbiddenException(
          'You are not authorized to delete this notification',
        );
      }
    }

    await this.prisma.notification.delete({
      where: { id },
    });
  }

  // Delete all notifications for a user
  async removeAll(
    userId: string,
    readOnly?: boolean,
  ): Promise<{ count: number }> {
    const where: Prisma.NotificationWhereInput = { userId };

    if (readOnly) {
      where.isRead = true;
    }

    const result = await this.prisma.notification.deleteMany({
      where,
    });

    return { count: result.count };
  }

  // Get the count of unread notifications
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return { count };
  }

  // Utility methods for different notification types

  async createCourseNotification(
    userId: string,
    courseId: string,
    title: string,
    message: string,
  ): Promise<NotificationResponseDto> {
    return this.create(userId, {
      type: NotificationType.COURSE,
      title,
      message,
      metadata: { courseId },
    });
  }

  async createExerciseNotification(
    userId: string,
    exerciseId: string,
    title: string,
    message: string,
  ): Promise<NotificationResponseDto> {
    return this.create(userId, {
      type: NotificationType.EXERCISE,
      title,
      message,
      metadata: { exerciseId },
    });
  }

  async createCommentNotification(
    userId: string,
    commentId: string,
    title: string,
    message: string,
  ): Promise<NotificationResponseDto> {
    return this.create(userId, {
      type: NotificationType.COMMENT,
      title,
      message,
      metadata: { commentId },
    });
  }

  async createAchievementNotification(
    userId: string,
    achievementId: string,
    title: string,
    message: string,
  ): Promise<NotificationResponseDto> {
    return this.create(userId, {
      type: NotificationType.ACHIEVEMENT,
      title,
      message,
      metadata: { achievementId },
    });
  }

  // Map to response DTO
  private mapToNotificationResponseDto(
    notification: Notification,
  ): NotificationResponseDto {
    const dto = new NotificationResponseDto();
    dto.id = notification.id;
    dto.type = notification.type;
    dto.title = notification.title;
    dto.message = notification.message;
    dto.userId = notification.userId;
    dto.isRead = notification.isRead;
    dto.metadata = notification.metadata as Record<string, unknown>;
    dto.createdAt = notification.createdAt;
    dto.readAt = notification.readAt || undefined;

    return dto;
  }
}
