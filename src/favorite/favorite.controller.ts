import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { FavoriteService } from './favorite.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Course } from '@prisma/client';

@ApiTags('Favorites')
@Controller('favorites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user favorites' })
  @ApiResponse({ status: 200, description: 'List of favorite courses' })
  async getFavorites(@CurrentUser('id') userId: string): Promise<Course[]> {
    return this.favoriteService.getFavorites(userId);
  }

  @Post(':courseId')
  @ApiOperation({ summary: 'Add a course to favorites' })
  @ApiResponse({ status: 201, description: 'Course added to favorites' })
  @ApiResponse({ status: 400, description: 'Course already in favorites' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async addFavorite(
    @CurrentUser('id') userId: string,
    @Param('courseId') courseId: string,
  ): Promise<void> {
    return this.favoriteService.addFavorite(userId, courseId);
  }

  @Delete(':courseId')
  @ApiOperation({ summary: 'Remove a course from favorites' })
  @ApiResponse({ status: 200, description: 'Course removed from favorites' })
  @ApiResponse({ status: 404, description: 'Favorite not found' })
  async removeFavorite(
    @CurrentUser('id') userId: string,
    @Param('courseId') courseId: string,
  ): Promise<void> {
    return this.favoriteService.removeFavorite(userId, courseId);
  }
}
