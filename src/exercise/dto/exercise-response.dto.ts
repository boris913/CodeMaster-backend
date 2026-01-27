// src/exercises/dto/exercise-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Exercise, Language, Difficulty } from '@prisma/client';

export class ExerciseResponseDto implements Partial<Exercise> {
  @ApiProperty({ description: "ID de l'exercice" })
  id: string;

  @ApiProperty({ description: "Titre de l'exercice" })
  title: string;

  @ApiProperty({ description: "Instructions de l'exercice" })
  instructions: string;

  @ApiProperty({ description: 'Code de départ' })
  starterCode: string;

  @ApiProperty({ description: 'Langage de programmation' })
  language: Language;

  @ApiProperty({ enum: Difficulty, description: 'Difficulté' })
  difficulty: Difficulty;

  @ApiProperty({ type: [String], description: 'Indices' })
  hints: string[];

  @ApiProperty({ description: 'Limite de temps en secondes' })
  timeLimit: number;

  @ApiProperty({ description: 'Limite de mémoire en MB' })
  memoryLimit: number;

  @ApiProperty({ description: 'Points pour la réussite' })
  points: number;

  @ApiProperty({ description: 'ID de la leçon associée' })
  lessonId: string;

  @ApiProperty({ description: 'Date de création' })
  createdAt: Date;

  @ApiProperty({ description: 'Date de mise à jour' })
  updatedAt: Date;
}
