import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class LessonProgressDto {
  @ApiProperty({ description: 'Position in video (seconds)', minimum: 0 })
  @IsNumber()
  @Min(0)
  position: number;

  @ApiProperty({ description: 'Time spent on lesson (seconds)', minimum: 0 })
  @IsNumber()
  @Min(0)
  timeSpent?: number = 0;
}
