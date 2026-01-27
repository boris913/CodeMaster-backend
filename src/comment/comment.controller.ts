// src/comments/comment.controller.ts
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
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Comments')
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Créer un commentaire',
    description: 'Créer un nouveau commentaire sur une leçon',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Commentaire créé avec succès',
    type: CommentResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Leçon non trouvée',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Non inscrit au cours',
  })
  async create(
    @Body() createCommentDto: CreateCommentDto,
    @CurrentUser('id') userId: string,
  ): Promise<CommentResponseDto> {
    return this.commentService.create(createCommentDto, userId);
  }

  @Get('lesson/:lessonId')
  @ApiOperation({
    summary: "Récupérer les commentaires d'une leçon",
    description: "Récupère tous les commentaires d'une leçon (avec pagination)",
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
    description: 'Éléments par page (défaut: 20)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Commentaires récupérés avec succès',
  })
  async findByLesson(
    @Param('lessonId') lessonId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.commentService.findByLesson(lessonId, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer un commentaire',
    description: 'Récupère un commentaire spécifique avec ses réponses',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Commentaire récupéré avec succès',
    type: CommentResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Commentaire non trouvé',
  })
  async findOne(@Param('id') id: string): Promise<CommentResponseDto> {
    return this.commentService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Mettre à jour un commentaire',
    description: "Met à jour le contenu d'un commentaire",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Commentaire mis à jour avec succès',
    type: CommentResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Commentaire non trouvé',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Non autorisé à modifier ce commentaire',
  })
  async update(
    @Param('id') id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @CurrentUser('id') userId: string,
  ): Promise<CommentResponseDto> {
    return this.commentService.update(id, updateCommentDto, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Supprimer un commentaire',
    description: 'Supprime un commentaire existant',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Commentaire supprimé avec succès',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Commentaire non trouvé',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Non autorisé à supprimer ce commentaire',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.commentService.remove(id, userId);
  }

  @Post(':id/reply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Répondre à un commentaire',
    description: 'Créer une réponse à un commentaire existant',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Réponse créée avec succès',
    type: CommentResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Commentaire parent non trouvé',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Non autorisé à répondre',
  })
  async reply(
    @Param('id') id: string,
    @Body() createCommentDto: CreateCommentDto,
    @CurrentUser('id') userId: string,
  ): Promise<CommentResponseDto> {
    return this.commentService.reply(id, createCommentDto, userId);
  }
}
