import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({ description: 'Module title', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Module description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Module duration in minutes',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number = 0;
}
