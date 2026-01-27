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
    description: "Titre de l'exercice",
    example: 'Calcul de factorielle',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: "Instructions de l'exercice (Markdown)",
    example: "Écrivez une fonction qui calcule la factorielle d'un nombre.",
  })
  @IsString()
  instructions: string;

  @ApiProperty({
    description: 'Code de départ',
    example: 'function factorial(n) {\n  // Ton code ici\n}',
  })
  @IsString()
  starterCode: string;

  @ApiProperty({
    description: 'Solution de référence',
    example:
      'function factorial(n) {\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}',
  })
  @IsString()
  solution: string;

  @ApiProperty({
    description: 'Tests unitaires',
    example:
      'describe("factorial", () => {\n  it("should return 1 for 0", () => {\n    expect(factorial(0)).toBe(1);\n  });\n})',
  })
  @IsString()
  tests: string;

  @ApiProperty({ enum: Language, description: 'Langage de programmation' })
  @IsEnum(Language)
  language: Language;

  @ApiProperty({ enum: Difficulty, description: 'Difficulté', required: false })
  @IsEnum(Difficulty)
  @IsOptional()
  difficulty?: Difficulty;

  @ApiProperty({ type: [String], description: 'Indices', required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  hints?: string[];

  @ApiProperty({
    description: 'Limite de temps en secondes',
    example: 30,
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(300)
  @IsOptional()
  timeLimit?: number;

  @ApiProperty({
    description: 'Limite de mémoire en MB',
    example: 128,
    required: false,
  })
  @IsInt()
  @Min(16)
  @Max(1024)
  @IsOptional()
  memoryLimit?: number;

  @ApiProperty({
    description: 'Points pour la réussite',
    example: 10,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  points?: number;

  @ApiProperty({ description: 'ID de la leçon associée' })
  @IsString()
  lessonId: string;
}
