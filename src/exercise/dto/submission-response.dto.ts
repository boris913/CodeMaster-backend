// src/exercises/dto/submission-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Submission, SubmissionStatus, Language } from '@prisma/client';

export class SubmissionResponseDto implements Partial<Submission> {
  @ApiProperty({ description: 'Submission ID' })
  id: string;

  @ApiProperty({ description: 'Submitted code' })
  code: string;

  @ApiProperty({ enum: Language, description: 'Language used' })
  language: Language;

  @ApiProperty({
    enum: SubmissionStatus,
    description: 'Submission status',
  })
  status: SubmissionStatus;

  @ApiProperty({ description: 'Test results (JSON)' })
  result: any;

  @ApiProperty({ description: 'Execution time in ms' })
  executionTime: number;

  @ApiProperty({ description: 'Memory used in KB' })
  memoryUsed: number;

  @ApiProperty({ description: 'Passed tests count' })
  passedTests: number;

  @ApiProperty({ description: 'Total number of tests' })
  totalTests: number;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Exercise ID' })
  exerciseId: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;
}
