import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  resetSecret: string;
  accessExpiration: string;
  refreshExpiration: string;
}

export default registerAs(
  'jwt',
  (): JwtConfig => ({
    accessSecret:
      process.env.JWT_ACCESS_SECRET ||
      'your-fallback-secret-key-do-not-use-in-production',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ||
      'your-fallback-refresh-secret-key-do-not-use-in-production',
    resetSecret:
      process.env.JWT_RESET_SECRET ||
      'your-fallback-reset-secret-key-do-not-use-in-production',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '1h',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  }),
);
