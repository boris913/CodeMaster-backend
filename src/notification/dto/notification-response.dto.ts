// src/notifications/dto/notification-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class NotificationResponseDto {
  @ApiProperty({ description: 'Unique identifier of the notification' })
  id: string;

  @ApiProperty({ enum: NotificationType, description: 'Type of notification' })
  type: NotificationType;

  @ApiProperty({ description: 'Notification title' })
  title: string;

  @ApiProperty({ description: 'Notification message body' })
  message: string;

  @ApiProperty({ description: 'ID of the recipient user' })
  userId: string;

  @ApiProperty({ description: 'Indicates if the notification has been read' })
  isRead: boolean;

  @ApiProperty({
    description: 'Additional associated metadata',
    required: false,
  })
  metadata?: Record<string, unknown>;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp of when the notification was read',
    required: false,
  })
  readAt?: Date;
}
