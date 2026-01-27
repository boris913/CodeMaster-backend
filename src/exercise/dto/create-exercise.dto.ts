// src/exercises/dto/create-exercise.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Language, Difficulty } from '@prisma/client';
import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateExerciseDto {
  @ApiProperty({
    description: 'Exercise title',
    example: 'Factorial Calculation',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Exercise instructions (Markdown)',
    example: 'Write a function that calculates the factorial of a number.',
  })
  @IsString()
  instructions: string;

  @ApiProperty({
    description: 'Starter code',
    example: 'function factorial(n) {\n  // Your code here\n}',
  })
  @IsString()
  starterCode: string;

  @ApiProperty({
    description: 'Reference solution',
    example:
      'function factorial(n) {\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}',
  })
  @IsString()
  solution: string;

  @ApiProperty({
    description: 'Unit tests',
    example:
      'describe("factorial", () => {\n  it("should return 1 for 0", () => {\n    expect(factorial(0)).toBe(1);\n  });\n})',
  })
  @IsString()
  tests: string;

  @ApiProperty({ enum: Language, description: 'Programming language' })
  @IsEnum(Language)
  language: Language;

  @ApiProperty({
    enum: Difficulty,
    description: 'Difficulty level',
    required: false,
  })
  @IsEnum(Difficulty)
  @IsOptional()
  difficulty?: Difficulty;

  @ApiProperty({ type: [String], description: 'Hints', required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  hints?: string[];

  @ApiProperty({
    description: 'Time limit in seconds',
    example: 30,
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(300)
  @IsOptional()
  timeLimit?: number;

  @ApiProperty({
    description: 'Memory limit in MB',
    example: 128,
    required: false,
  })
  @IsInt()
  @Min(16)
  @Max(1024)
  @IsOptional()
  memoryLimit?: number;

  @ApiProperty({
    description: 'Points awarded for success',
    example: 10,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  points?: number;

  @ApiProperty({ description: 'Associated lesson ID' })
  @IsString()
  lessonId: string;
}
