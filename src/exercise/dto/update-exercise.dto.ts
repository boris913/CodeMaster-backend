// src/exercises/dto/update-exercise.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { CreateExerciseDto } from './create-exercise.dto';

export class UpdateExerciseDto extends PartialType(CreateExerciseDto) {
  @ApiProperty({ description: "Titre de l'exercice", required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ description: "Instructions de l'exercice", required: false })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiProperty({ description: 'Code de départ', required: false })
  @IsString()
  @IsOptional()
  starterCode?: string;

  @ApiProperty({ description: 'Solution de référence', required: false })
  @IsString()
  @IsOptional()
  solution?: string;

  @ApiProperty({ description: 'Tests unitaires', required: false })
  @IsString()
  @IsOptional()
  tests?: string;
}
