import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'Email address' })
  email: string;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiProperty({ description: 'First name', required: false })
  firstName?: string;

  @ApiProperty({ description: 'Last name', required: false })
  lastName?: string;

  @ApiProperty({ description: 'Avatar URL', required: false })
  avatar?: string;

  @ApiProperty({ description: 'Biography', required: false })
  bio?: string;

  @ApiProperty({ enum: Role, description: 'User role' })
  role: Role;

  @ApiProperty({ description: 'Account active status' })
  isActive: boolean;

  @ApiProperty({ description: 'Email verified status' })
  emailVerified: boolean;

  @ApiProperty({ description: 'Last login date', required: false })
  lastLogin?: Date;

  @ApiProperty({ description: 'GitHub ID', required: false })
  githubId?: string;

  @ApiProperty({ description: 'Google ID', required: false })
  googleId?: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Soft delete date', required: false })
  deletedAt?: Date;

  @ApiProperty({ description: 'User statistics', required: false })
  stats?: {
    coursesEnrolled: number;
    coursesCompleted: number;
    totalSubmissions: number;
    averageExerciseScore: number;
  };
}
