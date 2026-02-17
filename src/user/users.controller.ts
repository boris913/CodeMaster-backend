import {
  Controller,
  Get,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService, UserStats } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UsersFilterDto } from './dto/users-filter.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UploadAvatarDto } from './dto/upload-avatar.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role, SubmissionStatus } from '@prisma/client';

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile retrieved successfully',
    type: UserResponseDto,
  })
  async getCurrentUser(
    @CurrentUser('id') userId: string,
  ): Promise<UserResponseDto> {
    return this.usersService.getCurrentUser(userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
    type: UserResponseDto,
  })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(userId, updateProfileDto);
  }

  @Put('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadAvatarDto })
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Avatar uploaded successfully',
    type: UserResponseDto,
  })
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UserResponseDto> {
    return this.usersService.uploadAvatar(userId, file);
  }

  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete user avatar' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Avatar deleted successfully',
    type: UserResponseDto,
  })
  async deleteAvatar(
    @CurrentUser('id') userId: string,
  ): Promise<UserResponseDto> {
    return this.usersService.deleteAvatar(userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all users (admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Users retrieved successfully',
  })
  async findAllUsers(
    @CurrentUser('id') requesterId: string,
    @Query() filter: UsersFilterDto,
  ): Promise<PaginatedResponse<UserResponseDto>> {
    return this.usersService.findAllUsers(filter, requesterId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User retrieved successfully',
    type: UserResponseDto,
  })
  async findUserById(
    @Param('id') userId: string,
    @CurrentUser('id') requesterId: string,
  ): Promise<UserResponseDto> {
    return this.usersService.findUserById(userId, requesterId);
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update user role and status (admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User role updated successfully',
    type: UserResponseDto,
  })
  async updateUserRole(
    @Param('id') userId: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
    @CurrentUser('id') requesterId: string,
  ): Promise<UserResponseDto> {
    return this.usersService.updateUserRole(
      userId,
      updateUserRoleDto,
      requesterId,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft delete user (admin only)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'User deleted successfully',
  })
  async softDeleteUser(
    @Param('id') userId: string,
    @CurrentUser('id') requesterId: string,
  ): Promise<void> {
    return this.usersService.softDeleteUser(userId, requesterId);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User statistics retrieved successfully',
  })
  async getUserStats(
    @Param('id') userId: string,
    @CurrentUser('id') requesterId: string,
  ): Promise<UserStats> {
    await this.usersService.findUserById(userId, requesterId);
    return this.usersService.getUserStats(userId);
  }

  @Get(':id/enrollments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get user course enrollments' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Enrollments retrieved successfully',
  })
  async getUserEnrollments(
    @Param('id') userId: string,
    @CurrentUser('id') requesterId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    await this.usersService.findUserById(userId, requesterId);
    return this.usersService.getUserEnrollments(userId, page, limit);
  }

  @Get(':id/submissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get user exercise submissions' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Submissions retrieved successfully',
  })
  async getUserSubmissions(
    @Param('id') userId: string,
    @CurrentUser('id') requesterId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: SubmissionStatus,
  ) {
    await this.usersService.findUserById(userId, requesterId);
    return this.usersService.getUserSubmissions(userId, page, limit, status);
  }

  @Get('check-email')
  @Public() // accessible sans authentification
  @ApiOperation({ summary: 'Check if email is available' })
  @ApiQuery({ name: 'email', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Returns availability status',
    schema: { example: { available: true } },
  })
  async checkEmail(
    @Query('email') email: string,
  ): Promise<{ available: boolean }> {
    const exists = await this.usersService.findByEmail(email);
    return { available: !exists };
  }

  @Get('check-username')
  @Public()
  @ApiOperation({ summary: 'Check if username is available' })
  @ApiQuery({ name: 'username', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Returns availability status',
    schema: { example: { available: true } },
  })
  async checkUsername(
    @Query('username') username: string,
  ): Promise<{ available: boolean }> {
    const exists = await this.usersService.findByUsername(username);
    return { available: !exists };
  }
}
