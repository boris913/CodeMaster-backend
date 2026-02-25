import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Course } from '@prisma/client';

@Injectable()
export class FavoriteService {
  constructor(private readonly prisma: PrismaService) {}

  async getFavorites(userId: string): Promise<Course[]> {
    const favorites = await this.prisma.userFavorite.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            instructor: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
            tags: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return favorites.map((f) => f.course);
  }

  async addFavorite(userId: string, courseId: string): Promise<void> {
    // Vérifier que le cours existe
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Vérifier si déjà favori
    const existing = await this.prisma.userFavorite.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });
    if (existing) {
      throw new BadRequestException('Course already in favorites');
    }

    await this.prisma.userFavorite.create({
      data: { userId, courseId },
    });
  }

  async removeFavorite(userId: string, courseId: string): Promise<void> {
    const favorite = await this.prisma.userFavorite.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });
    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    await this.prisma.userFavorite.delete({
      where: { id: favorite.id },
    });
  }
}
