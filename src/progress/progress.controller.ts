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
} from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import {
  CourseProgressResponse,
  LeaderboardEntry,
} from './types/progress.types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Progress')
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

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
}
