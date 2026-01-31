import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokensDto } from './dto/tokens.dto';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<TokensDto> {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    // Check if username already exists
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: registerDto.username },
    });

    if (existingUsername) {
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

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Save refresh token
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async login(loginDto: LoginDto): Promise<TokensDto> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is active
    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Save refresh token
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    // Find and invalidate refresh token
    const token = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (token && token.userId === userId && !token.revoked) {
      await this.prisma.refreshToken.update({
        where: { id: token.id },
        data: { revoked: true },
      });
    }
  }

  async refreshTokens(refreshToken: string): Promise<TokensDto> {
    // Verify refresh token
    const token = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!token || token.revoked || token.expiresAt < new Date()) {
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
      return null;
    }

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

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
    };
  }

  private async saveRefreshToken(userId: string, token: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });
  }

  async initiatePasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // For security reasons, don't reveal if email exists
      return;
    }

    // Get reset secret
    const resetSecret = this.configService.get<string>('JWT_RESET_SECRET');
    if (!resetSecret) {
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
    console.log(`Reset token for ${email}: ${resetToken}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      // Get reset secret
      const resetSecret = this.configService.get<string>('JWT_RESET_SECRET');
      if (!resetSecret) {
        throw new BadRequestException('Reset configuration error');
      }

      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        purpose: string;
      }>(token, {
        secret: resetSecret,
      });

      if (payload.purpose !== 'password_reset') {
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
    } catch (error: unknown) {
      // Type guard to check if it's an error
      if (error instanceof Error) {
        console.error('Password reset error:', error.message);
      }
      throw new BadRequestException('Invalid or expired token');
    }
  }
}
