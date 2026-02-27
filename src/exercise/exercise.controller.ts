// src/exercise/exercise.controller.ts
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
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ExerciseService } from './exercise.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { SubmitExerciseDto } from './dto/submit-exercise.dto';
import { ExerciseResponseDto } from './dto/exercise-response.dto';
import { SubmissionResponseDto } from './dto/submission-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role, Language } from '@prisma/client';

interface TestResult {
  name?: string;
  passed?: boolean;
  error?: string;
}

interface ExecutionResult {
  output: string;
  error: string;
  executionTime: number;
  memoryUsed: number;
  passed: boolean;
  testResults?: TestResult[];
}

@ApiTags('Exercises')
@Controller('exercises')
export class ExerciseController {
  constructor(private readonly exerciseService: ExerciseService) {}

  // ─────────────────────────────────────────────────────────────
  // POST /exercises
  // Création générique (lessonId dans le body)
  // ─────────────────────────────────────────────────────────────
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create a new exercise',
    description:
      'Create a programming exercise linked to a lesson via body (instructors/admins only)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Exercise created successfully',
    type: ExerciseResponseDto,
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Lesson not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'This lesson already has an associated exercise',
  })
  async create(
    @Body() createExerciseDto: CreateExerciseDto,
    @CurrentUser('id') userId: string,
  ): Promise<ExerciseResponseDto> {
    return this.exerciseService.create(createExerciseDto, userId);
  }

  // ─────────────────────────────────────────────────────────────
  // POST /exercises/lessons/:lessonId/exercise          ← NOUVEAU
  // Route RESTful liée à la leçon — utilisée par le frontend
  // à la page /courses/by-id/[id]/modules/[mid]/lessons/[lid]/exercise/create
  // ─────────────────────────────────────────────────────────────
  @Post('lessons/:lessonId/exercise')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create an exercise for a specific lesson (RESTful)',
    description:
      'Creates a programming exercise directly linked to a lesson via the URL parameter. ' +
      'The lessonId in the URL takes precedence over any lessonId in the request body.',
  })
  @ApiParam({
    name: 'lessonId',
    description: 'ID of the lesson to attach the exercise to',
    example: 'clxyz123abc456def789',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Exercise created successfully',
    type: ExerciseResponseDto,
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Lesson not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'This lesson already has an associated exercise',
  })
  async createForLesson(
    @Param('lessonId') lessonId: string,
    // On injecte le lessonId du param dans le DTO pour réutiliser create()
    @Body() createExerciseDto: CreateExerciseDto,
    @CurrentUser('id') userId: string,
  ): Promise<ExerciseResponseDto> {
    // Le lessonId du param URL prend la priorité sur l'éventuel lessonId du body
    return this.exerciseService.create(
      { ...createExerciseDto, lessonId },
      userId,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // GET /exercises/:id
  // ─────────────────────────────────────────────────────────────
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Retrieve an exercise by ID',
    description:
      'Gets exercise details. Solution and full tests are hidden for students.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Exercise retrieved successfully',
    type: ExerciseResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Exercise not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not enrolled in course',
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<ExerciseResponseDto> {
    return this.exerciseService.findOne(id, userId);
  }

  // ─────────────────────────────────────────────────────────────
  // POST /exercises/:id/submit
  // ─────────────────────────────────────────────────────────────
  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Submit a solution',
    description:
      'Submit a solution for an exercise. Returns PENDING immediately; ' +
      'poll GET /exercises/:id/submissions/:submissionId for the result.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Submission created (status: PENDING)',
    type: SubmissionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Exercise not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not enrolled in course',
  })
  async submit(
    @Param('id') id: string,
    @Body() submitExerciseDto: SubmitExerciseDto,
    @CurrentUser('id') userId: string,
  ): Promise<SubmissionResponseDto> {
    return this.exerciseService.submitSolution(id, userId, submitExerciseDto);
  }

  // ─────────────────────────────────────────────────────────────
  // GET /exercises/:id/submissions
  // ─────────────────────────────────────────────────────────────
  @Get(':id/submissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Retrieve user submissions history',
    description: 'Gets paginated submission history for a given exercise.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Submissions retrieved' })
  async getSubmissions(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.exerciseService.getUserSubmissions(id, userId, page, limit);
  }

  // ─────────────────────────────────────────────────────────────
  // GET /exercises/:id/leaderboard
  // ─────────────────────────────────────────────────────────────
  @Get(':id/leaderboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Retrieve leaderboard' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Leaderboard retrieved' })
  async getLeaderboard(
    @Param('id') id: string,
    @Query('limit') limit: number = 20,
  ) {
    return this.exerciseService.getLeaderboard(id, limit);
  }

  // ─────────────────────────────────────────────────────────────
  // PATCH /exercises/:id
  // ─────────────────────────────────────────────────────────────
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update an exercise' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Exercise updated successfully',
    type: ExerciseResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Exercise not found',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async update(
    @Param('id') id: string,
    @Body() updateExerciseDto: UpdateExerciseDto,
    @CurrentUser('id') userId: string,
  ): Promise<ExerciseResponseDto> {
    return this.exerciseService.update(id, updateExerciseDto, userId);
  }

  // ─────────────────────────────────────────────────────────────
  // DELETE /exercises/:id
  // ─────────────────────────────────────────────────────────────
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete an exercise' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Exercise deleted',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Exercise not found',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.exerciseService.remove(id, userId);
  }

  // ─────────────────────────────────────────────────────────────
  // POST /exercises/:id/test  (instructeurs uniquement)
  // ─────────────────────────────────────────────────────────────
  @Post(':id/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Test an exercise solution (instructor only)',
    description:
      'Executes the provided code against the exercise test suite. ' +
      'Used by instructors to validate their solution before publishing.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tests executed successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Exercise not found',
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async testExercise(
    @Param('id') id: string,
    @Body() body: { code: string; language: Language },
    @CurrentUser('id') userId: string,
  ): Promise<ExecutionResult> {
    return this.exerciseService.testExerciseCode(
      id,
      userId,
      body.code,
      body.language,
    );
  }
}
