import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokensDto } from './dto/tokens.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { User } from '@prisma/client';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Create a new user account and return JWT tokens',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User successfully registered',
    type: TokensDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email or username already exists',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error',
  })
  async register(@Body() registerDto: RegisterDto): Promise<TokensDto> {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticate user and return JWT tokens',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully logged in',
    type: TokensDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Account is deactivated',
  })
  async login(@Body() loginDto: LoginDto): Promise<TokensDto> {
    return this.authService.login(loginDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'User logout',
    description: 'Invalidate refresh token and logout user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully logged out',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async logout(
    @CurrentUser('id') userId: string,
    @Body() logoutDto: LogoutDto,
  ): Promise<void> {
    return this.authService.logout(userId, logoutDto.refreshToken);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Get new access token using refresh token',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tokens successfully refreshed',
    type: TokensDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired refresh token',
  })
  async refreshTokens(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<TokensDto> {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Send password reset email to user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset email sent if account exists',
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<void> {
    return this.authService.initiatePasswordReset(forgotPasswordDto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password',
    description: 'Reset user password using reset token',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password successfully reset',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired token',
  })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<void> {
    // Validate that passwords match
    if (resetPasswordDto.newPassword !== resetPasswordDto.confirmPassword) {
      throw new Error('Passwords do not match');
    }

    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Get authenticated user profile information',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  getProfile(@CurrentUser() user: Partial<User>) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatar: user.avatar,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
    };
  }

  @Get('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Verify token',
    description: 'Verify if the access token is valid',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token is valid',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Token is invalid',
  })
  verifyToken(): { message: string } {
    return { message: 'Token is valid' };
  }
}
