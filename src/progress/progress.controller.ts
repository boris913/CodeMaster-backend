import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import {
  CourseProgressResponse,
  LeaderboardEntry,
  GlobalLeaderboardEntry,
} from './types/progress.types';
import { AdminRecentActivityDto } from './dto/admin-recent-activity.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Progress')
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('leaderboard/global')
  @ApiOperation({ summary: 'Get global leaderboard' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['weekly', 'monthly', 'all'],
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getGlobalLeaderboard(
    @Query('period') period?: 'weekly' | 'monthly' | 'all',
    @Query('limit') limit?: number,
  ): Promise<GlobalLeaderboardEntry[]> {
    return this.progressService.getGlobalLeaderboard(period, limit);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get user progress' })
  @ApiResponse({ status: 200, description: 'Progress retrieved successfully' })
  getUserProgress(
    @CurrentUser('id') userId: string,
    @Query('courseId') courseId?: string,
  ) {
    return this.progressService.getUserProgress(userId, courseId);
  }

  @Get('course/:courseId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get course progress for user' })
  @ApiResponse({
    status: 200,
    description: 'Course progress retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Not enrolled in course' })
  async getCourseProgress(
    @Param('courseId') courseId: string,
    @CurrentUser('id') userId: string,
  ): Promise<CourseProgressResponse> {
    return this.progressService.getCourseProgress(userId, courseId);
  }

  @Post('lesson/:lessonId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update lesson progress' })
  @ApiResponse({ status: 200, description: 'Progress updated successfully' })
  @ApiResponse({ status: 403, description: 'Not enrolled in course' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  updateProgress(
    @Param('lessonId') lessonId: string,
    @Body()
    data: {
      completed?: boolean;
      timeSpent?: number;
      lastPosition?: number;
    },
    @CurrentUser('id') userId: string,
  ) {
    return this.progressService.updateProgress(userId, lessonId, data);
  }

  @Get('lesson/:lessonId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get progress for a specific lesson' })
  @ApiResponse({
    status: 200,
    description: 'Lesson progress retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiResponse({ status: 403, description: 'Not enrolled in course' })
  async getLessonProgress(
    @Param('lessonId') lessonId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.progressService.getLessonProgress(userId, lessonId);
  }

  @Get('recent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get recent activity' })
  @ApiResponse({
    status: 200,
    description: 'Recent activity retrieved successfully',
  })
  getRecentActivity(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.progressService.getRecentActivity(userId, limit);
  }

  @Get('leaderboard/:courseId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get course leaderboard' })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard retrieved successfully',
  })
  async getLeaderboard(
    @Param('courseId') courseId: string,
    @Query('limit') limit?: number,
  ): Promise<LeaderboardEntry[]> {
    return this.progressService.getLeaderboard(courseId, limit);
  }

  @Get('admin/recent-activities')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get recent activities of all users (admin only)' })
  async getAdminRecentActivities(
    @Query('limit') limit?: number,
  ): Promise<AdminRecentActivityDto[]> {
    return this.progressService.getAdminRecentActivities(limit);
  }
}
