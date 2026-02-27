import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  // Gardé vide ou supprimé — le refreshToken est lu depuis le cookie
  @ApiPropertyOptional({ description: 'Kept for backward compatibility' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
