import { ApiPropertyOptional } from '@nestjs/swagger';

export class EnrollCourseDto {
  @ApiPropertyOptional({ description: 'Optional metadata for enrollment' })
  metadata?: Record<string, any>;
}
