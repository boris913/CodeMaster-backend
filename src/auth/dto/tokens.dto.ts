import { ApiProperty } from '@nestjs/swagger';

export class TokensDto {
  @ApiProperty({
    description: 'JWT Access Token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'JWT Refresh Token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken!: string;

  @ApiProperty({
    description: 'Token type',
    example: 'Bearer',
  })
  tokenType!: string;

  @ApiProperty({
    description: 'Validity duration in seconds',
    example: 3600,
  })
  expiresIn!: number;
}
