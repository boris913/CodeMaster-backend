import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Put,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LessonService } from './lesson.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Lessons')
@Controller()
export class LessonController {
  constructor(private readonly lessonService: LessonService) {}

  @Post('modules/:moduleId/lessons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new lesson' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Lesson created successfully',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found',
  })
  create(
    @Param('moduleId') moduleId: string,
    @Body() createLessonDto: CreateLessonDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.lessonService.createLesson(moduleId, createLessonDto, userId);
  }

  @Get('modules/:moduleId/lessons')
  @ApiOperation({ summary: 'Get all lessons for a module' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lessons retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Module is not accessible',
  })
  findAll(
    @Param('moduleId') moduleId: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.lessonService.findAllLessons(moduleId, userId);
  }

  @Get('lessons/:identifier')
  @ApiOperation({ summary: 'Get lesson by ID or slug' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lesson retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Lesson not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Lesson is not accessible',
  })
  findOne(
    @Param('identifier') identifier: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.lessonService.findLessonByIdOrSlug(identifier, userId);
  }

  @Patch('lessons/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a lesson' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lesson updated successfully',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Lesson not found',
  })
  update(
    @Param('id') id: string,
    @Body() updateLessonDto: UpdateLessonDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.lessonService.updateLesson(id, updateLessonDto, userId);
  }

  @Delete('lessons/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a lesson' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Lesson deleted successfully',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Lesson not found',
  })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.lessonService.deleteLesson(id, userId);
  }

  @Put('modules/:moduleId/lessons/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reorder lessons' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lessons reordered successfully',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid lesson IDs',
  })
  reorder(
    @Param('moduleId') moduleId: string,
    @Body('lessonIds') lessonIds: string[],
    @CurrentUser('id') userId: string,
  ) {
    return this.lessonService.reorderLessons(moduleId, lessonIds, userId);
  }

  @Post('lessons/:id/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Mark lesson as completed' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lesson marked as completed',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Lesson not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not enrolled in course',
  })
  async markAsCompleted(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body('timeSpent') timeSpent?: number,
  ) {
    return this.lessonService.markAsCompleted(id, userId, timeSpent);
  }

  @Post('lessons/:id/position')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update video position' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Position updated successfully',
  })
  updateVideoPosition(
    @Param('id') id: string,
    @Body('position') position: number,
    @CurrentUser('id') userId: string,
  ) {
    return this.lessonService.updateVideoPosition(id, userId, position);
  }
}
