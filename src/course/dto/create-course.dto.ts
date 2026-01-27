import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  MaxLength,
  IsArray,
} from 'class-validator';
import { Difficulty } from '@prisma/client';

export class CreateCourseDto {
  @ApiProperty({ description: 'Course title', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Course slug', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  slug: string;

  @ApiProperty({ description: 'Course description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Short description', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @ApiPropertyOptional({ description: 'Thumbnail URL', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnail?: string;

  @ApiPropertyOptional({ description: 'Course difficulty', enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty = Difficulty.BEGINNER;

  @ApiPropertyOptional({
    description: 'Course duration in minutes',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number = 0;

  @ApiPropertyOptional({ description: 'Course tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] = [];
}
