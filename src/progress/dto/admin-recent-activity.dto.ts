// src/progress/dto/admin-recent-activity.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class AdminRecentActivityDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  userAvatar?: string;

  @ApiProperty()
  type:
    | 'lesson_completed'
    | 'course_enrolled'
    | 'exercise_submitted'
    | 'course_completed';

  @ApiProperty()
  description: string;

  @ApiProperty()
  createdAt: Date;
}
