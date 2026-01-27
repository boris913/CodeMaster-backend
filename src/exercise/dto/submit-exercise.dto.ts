// src/exercises/dto/submit-exercise.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Language } from '@prisma/client';
import { IsString, IsEnum, IsOptional } from 'class-validator';

export class SubmitExerciseDto {
  @ApiProperty({ description: "Code soumis par l'utilisateur" })
  @IsString()
  code: string;

  @ApiProperty({ enum: Language, description: 'Langage utilisé' })
  @IsEnum(Language)
  language: Language;

  @ApiProperty({
    description: 'Input personnalisé (optionnel)',
    required: false,
  })
  @IsString()
  @IsOptional()
  customInput?: string;
}
