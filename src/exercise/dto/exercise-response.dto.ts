// src/exercises/dto/exercise-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Exercise, Language, Difficulty } from '@prisma/client';

export class ExerciseResponseDto implements Partial<Exercise> {
  @ApiProperty({ description: 'Exercise ID' })
  id: string;

  @ApiProperty({ description: 'Exercise title' })
  title: string;

  @ApiProperty({ description: 'Exercise instructions' })
  instructions: string;

  @ApiProperty({ description: 'Starter code' })
  starterCode: string;

  @ApiProperty({ description: 'Programming language' })
  language: Language;

  @ApiProperty({ enum: Difficulty, description: 'Difficulty level' })
  difficulty: Difficulty;

  @ApiProperty({ type: [String], description: 'Hints' })
  hints: string[];

  @ApiProperty({ description: 'Time limit in seconds' })
  timeLimit: number;

  @ApiProperty({ description: 'Memory limit in MB' })
  memoryLimit: number;

  @ApiProperty({ description: 'Points awarded for success' })
  points: number;

  @ApiProperty({ description: 'Associated lesson ID' })
  lessonId: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Update date' })
  updatedAt: Date;
}
