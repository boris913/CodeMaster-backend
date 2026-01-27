import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
  IsBoolean,
  IsUrl,
  IsEnum,
} from 'class-validator';
import { VideoType } from '@prisma/client';

export class CreateLessonDto {
  @ApiProperty({ description: 'Lesson title', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Lesson content in Markdown format' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Video URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl({}, { message: 'Invalid URL format' })
  videoUrl?: string;

  @ApiPropertyOptional({
    description: 'Lesson duration in minutes',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number = 0;

  @ApiPropertyOptional({
    description: 'Whether the lesson is free',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isFree?: boolean = false;

  @ApiPropertyOptional({ description: 'Video type', enum: VideoType })
  @IsOptional()
  @IsEnum(VideoType)
  videoType?: VideoType;
}
