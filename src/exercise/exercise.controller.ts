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
    summary: 'Créer un nouvel exercice',
    description:
      'Créer un exercice de programmation (instructeurs/admins uniquement)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Exercice créé avec succès',
    type: ExerciseResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Accès non autorisé',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Leçon non trouvée',
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
    summary: 'Récupérer un exercice par ID',
    description: "Récupère les détails d'un exercice",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Exercice récupéré avec succès',
    type: ExerciseResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Exercice non trouvé',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Non inscrit au cours',
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
    summary: 'Soumettre une solution',
    description: 'Soumettre une solution à un exercice',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Solution soumise avec succès',
    type: SubmissionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Exercice non trouvé',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Non inscrit au cours',
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
    summary: "Récupérer les soumissions d'un utilisateur",
    description: "Récupère l'historique des soumissions pour un exercice",
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numéro de page (défaut: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Éléments par page (défaut: 10)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Soumissions récupérées avec succès',
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
    summary: 'Récupérer le classement',
    description: 'Récupère le classement des meilleures soumissions',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: "Nombre d'entrées (défaut: 20)",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Classement récupéré avec succès',
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
    summary: 'Mettre à jour un exercice',
    description: 'Met à jour un exercice existant',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Exercice mis à jour avec succès',
    type: ExerciseResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Exercice non trouvé',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Accès non autorisé',
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
    summary: 'Supprimer un exercice',
    description: 'Supprime un exercice existant',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Exercice supprimé avec succès',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Exercice non trouvé',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Accès non autorisé',
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
    summary: 'Tester un exercice',
    description:
      'Exécute les tests sur un code donné (instructeurs et administrateurs uniquement)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tests exécutés avec succès',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Exercice non trouvé',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Accès non autorisé',
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
