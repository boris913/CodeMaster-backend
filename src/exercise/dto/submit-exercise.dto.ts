// src/exercises/dto/submit-exercise.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Language } from '@prisma/client';
import { IsString, IsEnum, IsOptional } from 'class-validator';

export class SubmitExerciseDto {
  @ApiProperty({ description: 'Code submitted by the user' })
  @IsString()
  code: string;

  @ApiProperty({ enum: Language, description: 'Language used' })
  @IsEnum(Language)
  language: Language;

  @ApiProperty({
    description: 'Custom input (optional)',
    required: false,
  })
  @IsString()
  @IsOptional()
  customInput?: string;
}
