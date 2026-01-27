// src/comments/dto/create-comment.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Content of the comment',
    example: 'Great course, thanks for the detailed explanations!',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'ID of the lesson',
    example: 'clxyz123abc456def789ghi',
  })
  @IsString()
  @IsNotEmpty()
  lessonId: string;

  @ApiProperty({
    description: 'ID of the parent comment (for replies)',
    example: 'clabc123def456ghi789jkl',
    required: false,
  })
  @IsString()
  @IsOptional()
  parentId?: string;
}
