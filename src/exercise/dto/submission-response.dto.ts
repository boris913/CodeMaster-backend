// src/exercises/dto/submission-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Submission, SubmissionStatus, Language } from '@prisma/client';

export class SubmissionResponseDto implements Partial<Submission> {
  @ApiProperty({ description: 'ID de la soumission' })
  id: string;

  @ApiProperty({ description: 'Code soumis' })
  code: string;

  @ApiProperty({ enum: Language, description: 'Langage utilisé' })
  language: Language;

  @ApiProperty({
    enum: SubmissionStatus,
    description: 'Statut de la soumission',
  })
  status: SubmissionStatus;

  @ApiProperty({ description: 'Résultats des tests (JSON)' })
  result: any;

  @ApiProperty({ description: "Temps d'exécution en ms" })
  executionTime: number;

  @ApiProperty({ description: 'Mémoire utilisée en KB' })
  memoryUsed: number;

  @ApiProperty({ description: 'Tests réussis' })
  passedTests: number;

  @ApiProperty({ description: 'Nombre total de tests' })
  totalTests: number;

  @ApiProperty({ description: "ID de l'utilisateur" })
  userId: string;

  @ApiProperty({ description: "ID de l'exercice" })
  exerciseId: string;

  @ApiProperty({ description: 'Date de création' })
  createdAt: Date;
}
