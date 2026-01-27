// src/notifications/dto/notification-filters.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class NotificationFiltersDto {
  @ApiProperty({
    description: 'Filter only unread notifications',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  unreadOnly?: boolean;

  @ApiProperty({
    description: 'Filter by notification type',
    required: false,
    enum: ['SYSTEM', 'COURSE', 'EXERCISE', 'COMMENT', 'ACHIEVEMENT'],
  })
  @IsOptional()
  type?: string;

  @ApiProperty({
    description: 'Page number for pagination',
    required: false,
    default: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    required: false,
    default: 20,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
