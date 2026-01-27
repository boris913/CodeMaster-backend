// src/comments/dto/update-comment.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty({
    description: 'Updated content of the comment',
    example: 'Modified content for better clarity',
    required: false,
  })
  @IsString()
  @IsOptional()
  content?: string;
}
