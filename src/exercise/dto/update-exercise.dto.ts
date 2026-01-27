// src/exercises/dto/update-exercise.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { CreateExerciseDto } from './create-exercise.dto';

export class UpdateExerciseDto extends PartialType(CreateExerciseDto) {
  @ApiProperty({ description: 'Exercise title', required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ description: 'Exercise instructions', required: false })
  @IsString()
  @IsOptional()
  instructions?: string;

  @ApiProperty({ description: 'Starter code', required: false })
  @IsString()
  @IsOptional()
  starterCode?: string;

  @ApiProperty({ description: 'Reference solution', required: false })
  @IsString()
  @IsOptional()
  solution?: string;

  @ApiProperty({ description: 'Unit tests', required: false })
  @IsString()
  @IsOptional()
  tests?: string;
}
