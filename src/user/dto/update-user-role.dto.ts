import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEnum, IsOptional, IsBoolean } from 'class-validator';

export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'User role',
    enum: Role,
    required: false,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiProperty({
    description: 'Account active status',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Email verified status',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;
}
