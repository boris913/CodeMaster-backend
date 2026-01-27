// src/exercises/exercise.controller.ts
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

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create a new exercise',
    description: 'Create a programming exercise (instructors/admins only)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Exercise created successfully',
    type: ExerciseResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Lesson not found',
  })
  async create(
    @Body() createExerciseDto: CreateExerciseDto,
    @CurrentUser('id') userId: string,
  ): Promise<ExerciseResponseDto> {
    return this.exerciseService.create(createExerciseDto, userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Retrieve an exercise by ID',
    description: 'Gets exercise details',
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

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Submit a solution',
    description: 'Submit a solution for an exercise',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Solution submitted successfully',
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

  @Get(':id/submissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Retrieve user submissions',
    description: 'Gets submission history for an exercise',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Submissions retrieved successfully',
  })
  async getSubmissions(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.exerciseService.getUserSubmissions(id, userId, page, limit);
  }

  @Get(':id/leaderboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Retrieve leaderboard',
    description: 'Gets the leaderboard of top submissions',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of entries (default: 20)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Leaderboard retrieved successfully',
  })
  async getLeaderboard(
    @Param('id') id: string,
    @Query('limit') limit: number = 20,
  ) {
    return this.exerciseService.getLeaderboard(id, limit);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update an exercise',
    description: 'Updates an existing exercise',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Exercise updated successfully',
    type: ExerciseResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Exercise not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied',
  })
  async update(
    @Param('id') id: string,
    @Body() updateExerciseDto: UpdateExerciseDto,
    @CurrentUser('id') userId: string,
  ): Promise<ExerciseResponseDto> {
    return this.exerciseService.update(id, updateExerciseDto, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete an exercise',
    description: 'Deletes an existing exercise',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Exercise deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Exercise not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.exerciseService.remove(id, userId);
  }

  @Post(':id/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Test an exercise',
    description:
      'Executes tests on a given code (instructors and administrators only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tests executed successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Exercise not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied',
  })
  async testExercise(
    @Param('id') id: string,
    @Body()
    body: {
      code: string;
      language: Language;
    },
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
