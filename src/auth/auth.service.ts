import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/Change-password.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokensDto } from './dto/tokens.dto';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<TokensDto> {
    this.logger.log(
      `Attempting to register user with email: ${registerDto.email}`,
    );

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      this.logger.warn(
        `Registration failed: email already exists - ${registerDto.email}`,
      );
      throw new ConflictException('A user with this email already exists');
    }

    // Check if username already exists
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: registerDto.username },
    });

    if (existingUsername) {
      this.logger.warn(
        `Registration failed: username already exists - ${registerDto.username}`,
      );
      throw new ConflictException('This username is already taken');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      registerDto.password,
      parseInt(this.configService.get<string>('BCRYPT_ROUNDS', '10')),
    );

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        username: registerDto.username,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      },
    });

    this.logger.log(`User registered successfully: ${user.id} - ${user.email}`);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Save refresh token
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async login(loginDto: LoginDto): Promise<TokensDto> {
    this.logger.log(`Login attempt for email: ${loginDto.email}`);

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      this.logger.warn(`Login failed: user not found - ${loginDto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is active
    if (!user.isActive) {
      this.logger.warn(`Login failed: account deactivated - ${user.id}`);
      throw new UnauthorizedException('Your account has been deactivated');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!passwordValid) {
      this.logger.warn(`Login failed: invalid password for user ${user.id}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    this.logger.log(`User logged in successfully: ${user.id}`);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Save refresh token
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    this.logger.log(`Logout attempt for user: ${userId}`);

    // Find and invalidate refresh token
    const token = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (token && token.userId === userId && !token.revoked) {
      await this.prisma.refreshToken.update({
        where: { id: token.id },
        data: { revoked: true },
      });
      this.logger.log(`Refresh token revoked for user: ${userId}`);
    } else {
      this.logger.warn(
        `Logout: refresh token not found or already revoked for user: ${userId}`,
      );
    }
  }

  async refreshTokens(refreshToken: string): Promise<TokensDto> {
    this.logger.log('Attempting to refresh tokens');

    // Verify refresh token
    const token = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!token || token.revoked || token.expiresAt < new Date()) {
      this.logger.warn('Refresh token invalid or expired');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Get user
    const user = token.user;

    // Generate new tokens
    const tokens = await this.generateTokens(user);

    // Mark old token as replaced
    await this.prisma.refreshToken.update({
      where: { id: token.id },
      data: { replacedBy: tokens.refreshToken },
    });

    // Save new refresh token
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`Tokens refreshed for user: ${user.id}`);
    return tokens;
  }

  async validateUser(userId: string): Promise<Partial<User> | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      this.logger.debug(
        `User validation failed for userId: ${userId} - not found or inactive`,
      );
      return null;
    }

    this.logger.debug(`User validated: ${userId}`);
    return user;
  }

  private async generateTokens(user: User): Promise<TokensDto> {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!accessSecret || !refreshSecret) {
      this.logger.error('JWT secrets are not configured');
      throw new Error('JWT secrets are not configured');
    }

    const accessExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRATION') ?? '1h';

    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d';

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessExpiresIn as JwtSignOptions['expiresIn'],
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id },
      {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as JwtSignOptions['expiresIn'],
      },
    );

    this.logger.debug(`Tokens generated for user: ${user.id}`);
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
    };
  }

  private async saveRefreshToken(userId: string, token: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Atomique + conserve les autres sessions
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      }),
      this.prisma.refreshToken.create({
        data: { token, userId, expiresAt },
      }),
    ]);
    this.logger.debug(`Refresh token saved for user: ${userId}`);
  }

  async initiatePasswordReset(email: string): Promise<void> {
    this.logger.log(`Initiating password reset for email: ${email}`);

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // For security reasons, don't reveal if email exists
      this.logger.debug(
        `Password reset requested for non-existent email: ${email}`,
      );
      return;
    }

    // Get reset secret
    const resetSecret = this.configService.get<string>('JWT_RESET_SECRET');
    if (!resetSecret) {
      this.logger.error('JWT_RESET_SECRET is not configured');
      throw new Error('JWT_RESET_SECRET is not configured');
    }

    // Generate reset token
    const resetToken = await this.jwtService.signAsync(
      { sub: user.id, purpose: 'password_reset' },
      {
        secret: resetSecret,
        expiresIn: '1h',
      },
    );

    // TODO: Send email with reset link
    this.logger.log(
      `Password reset token generated for user: ${user.id} (would send email)`,
    );
    // Ne pas logger le token en production, on le fait ici seulement pour debug temporaire
    this.logger.debug(`Reset token: ${resetToken}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    this.logger.log('Attempting to reset password with token');

    try {
      // Get reset secret
      const resetSecret = this.configService.get<string>('JWT_RESET_SECRET');
      if (!resetSecret) {
        this.logger.error('JWT_RESET_SECRET not configured');
        throw new BadRequestException('Reset configuration error');
      }

      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        purpose: string;
      }>(token, {
        secret: resetSecret,
      });

      if (payload.purpose !== 'password_reset') {
        this.logger.warn('Invalid token purpose for password reset');
        throw new BadRequestException('Invalid token');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { password: hashedPassword },
      });

      // Invalidate all existing user tokens
      await this.prisma.refreshToken.updateMany({
        where: { userId: payload.sub, revoked: false },
        data: { revoked: true },
      });

      this.logger.log(`Password reset successful for user: ${payload.sub}`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Password reset failed: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error('Password reset failed: unknown error');
      }
      throw new BadRequestException('Invalid or expired token');
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const passwordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!passwordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Optionnel : invalider tous les refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }
}
