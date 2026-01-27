// src/notifications/dto/create-notification.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({ enum: NotificationType, description: 'Type of notification' })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Notification title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Notification message body' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'Additional metadata (JSON object)',
    required: false,
    example: { courseId: 'clxyz...', lessonId: 'clabc...' },
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
