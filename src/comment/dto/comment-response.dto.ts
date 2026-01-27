// src/comments/dto/comment-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserInfoDto {
  @ApiProperty({ description: 'Unique identifier of the user' })
  id: string;

  @ApiProperty({ description: 'Username of the commenter' })
  username: string;

  @ApiProperty({
    required: false,
    description: 'URL of the user avatar',
  })
  avatar?: string;

  @ApiProperty({
    enum: Role,
    description: 'Security role of the user',
  })
  role: Role;
}

export class CommentResponseDto {
  @ApiProperty({ description: 'Unique identifier of the comment' })
  id: string;

  @ApiProperty({
    description: 'The actual text content of the comment',
    example: 'This lesson was very helpful!',
  })
  content: string;

  @ApiProperty({ description: 'ID of the user who authored the comment' })
  userId: string;

  @ApiProperty({ description: 'ID of the lesson where the comment was posted' })
  lessonId: string;

  @ApiProperty({
    description: 'ID of the parent comment if this is a reply',
    required: false,
    nullable: true,
  })
  parentId: string | null;

  @ApiProperty({
    description: 'Boolean flag indicating if the comment has been modified',
  })
  isEdited: boolean;

  @ApiProperty({ description: 'Timestamp of when the comment was created' })
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp of the last modification' })
  updatedAt: Date;

  @ApiProperty({
    type: UserInfoDto,
    description: 'Information about the author of the comment',
  })
  user: UserInfoDto;

  @ApiProperty({
    type: () => [CommentResponseDto],
    description: 'List of nested replies (threaded comments)',
  })
  replies: CommentResponseDto[];

  constructor() {
    this.replies = [];
  }
}
