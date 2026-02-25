import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ModuleProgress,
  CourseProgressResponse,
  LeaderboardEntry,
  GlobalLeaderboardEntry,
} from './types/progress.types';
import { PrismaService } from '../prisma/prisma.service';
import { AdminRecentActivityDto } from './dto/admin-recent-activity.dto';
import { Prisma, Progress } from '@prisma/client';

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserProgress(userId: string, courseId?: string) {
    const where: Prisma.ProgressWhereInput = { userId };

    if (courseId) {
      // Get all lessons in the course
      const lessons = await this.prisma.lesson.findMany({
        where: {
          module: {
            courseId,
          },
        },
        select: { id: true },
      });

      const lessonIds = lessons.map((lesson) => lesson.id);
      where.lessonId = { in: lessonIds };
    }

    const progress = await this.prisma.progress.findMany({
      where,
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return progress;
  }

  async getCourseProgress(
    userId: string,
    courseId: string,
  ): Promise<CourseProgressResponse> {
    // Check if user is enrolled in the course
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('You are not enrolled in this course');
    }

    // Get all lessons in the course
    const lessons = await this.prisma.lesson.findMany({
      where: {
        module: {
          courseId,
        },
      },
      include: {
        module: {
          select: {
            id: true,
            title: true,
            order: true,
          },
        },
      },
      orderBy: [
        {
          module: {
            order: 'asc',
          },
        },
        {
          order: 'asc',
        },
      ],
    });

    // Get progress for these lessons
    const progressRecords = await this.prisma.progress.findMany({
      where: {
        userId,
        lessonId: {
          in: lessons.map((lesson) => lesson.id),
        },
      },
    });

    const progressMap = new Map(
      progressRecords.map((record) => [record.lessonId, record]),
    );

    // Calculate statistics
    const completedLessons = progressRecords.filter(
      (record) => record.completed,
    );
    const totalTimeSpent = progressRecords.reduce(
      (sum, record) => sum + record.timeSpent,
      0,
    );

    // Group by module
    const modulesMap: Record<string, ModuleProgress> = {};

    lessons.forEach((lesson) => {
      const moduleId = lesson.module.id;
      if (!modulesMap[moduleId]) {
        modulesMap[moduleId] = {
          id: lesson.module.id,
          title: lesson.module.title,
          order: lesson.module.order,
          lessons: [],
          completedLessons: 0,
          totalLessons: 0,
          progress: 0,
        };
      }

      const lessonProgress = progressMap.get(lesson.id);
      const completed = lessonProgress?.completed || false;

      modulesMap[moduleId].lessons.push({
        id: lesson.id,
        title: lesson.title,
        slug: lesson.slug,
        duration: lesson.duration,
        order: lesson.order,
        completed,
        completedAt: lessonProgress?.completedAt || null,
        timeSpent: lessonProgress?.timeSpent || 0,
        lastPosition: lessonProgress?.lastPosition || null,
      });

      modulesMap[moduleId].totalLessons++;
      if (completed) {
        modulesMap[moduleId].completedLessons++;
      }
    });

    // Calculate progress for each module
    const modules = Object.values(modulesMap);
    modules.forEach((module) => {
      module.progress =
        module.totalLessons > 0
          ? Math.round((module.completedLessons / module.totalLessons) * 100)
          : 0;
    });

    // Calculate overall course progress
    const totalLessons = lessons.length;
    const overallProgress =
      totalLessons > 0
        ? Math.round((completedLessons.length / totalLessons) * 100)
        : 0;

    // Get last activity
    let lastActivity: Progress | null = null;
    if (progressRecords.length > 0) {
      lastActivity = progressRecords.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      )[0];
    }

    return {
      courseId,
      totalLessons,
      completedLessons: completedLessons.length,
      overallProgress,
      totalTimeSpent,
      modules: modules.sort((a, b) => a.order - b.order),
      lastActivity,
    };
  }

  async updateProgress(
    userId: string,
    lessonId: string,
    data: {
      completed?: boolean;
      timeSpent?: number;
      lastPosition?: number;
    },
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Check if user is enrolled in the course
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: lesson.module.course.id,
        },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('You are not enrolled in this course');
    }

    const existingProgress = await this.prisma.progress.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
    });

    const updateData: Prisma.ProgressUpdateInput = { ...data };

    // If marking as completed, set completedAt
    if (data.completed && !existingProgress?.completed) {
      updateData.completedAt = new Date();
    }

    // Increment timeSpent
    if (data.timeSpent && existingProgress) {
      updateData.timeSpent = { increment: data.timeSpent };
    } else if (data.timeSpent) {
      updateData.timeSpent = data.timeSpent;
    }

    if (existingProgress) {
      return this.prisma.progress.update({
        where: {
          userId_lessonId: {
            userId,
            lessonId,
          },
        },
        data: updateData,
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              module: {
                select: {
                  id: true,
                  title: true,
                  courseId: true,
                },
              },
            },
          },
        },
      });
    }

    return this.prisma.progress.create({
      data: {
        userId,
        lessonId,
        ...updateData,
      } as Prisma.ProgressCreateInput,
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            module: {
              select: {
                id: true,
                title: true,
                courseId: true,
              },
            },
          },
        },
      },
    });
  }

  async getRecentActivity(userId: string, limit: number = 10) {
    const progress = await this.prisma.progress.findMany({
      where: { userId },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: {
                  select: {
                    id: true,
                    title: true,
                    thumbnail: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
    });

    return progress.map((record) => ({
      id: record.id,
      lessonId: record.lessonId,
      lessonTitle: record.lesson.title,
      moduleId: record.lesson.module.id,
      moduleTitle: record.lesson.module.title,
      courseId: record.lesson.module.course.id,
      courseTitle: record.lesson.module.course.title,
      courseThumbnail: record.lesson.module.course.thumbnail,
      completed: record.completed,
      completedAt: record.completedAt,
      timeSpent: record.timeSpent,
      lastPosition: record.lastPosition,
      updatedAt: record.updatedAt,
    }));
  }

  async getLeaderboard(
    courseId: string,
    limit: number = 10,
  ): Promise<LeaderboardEntry[]> {
    // Get all enrollments for the course
    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    // Get all lessons in the course
    const lessons = await this.prisma.lesson.findMany({
      where: {
        module: {
          courseId,
        },
      },
      select: { id: true },
    });

    const lessonIds = lessons.map((lesson) => lesson.id);

    // Get progress for all users in this course
    const progress = await this.prisma.progress.groupBy({
      by: ['userId'],
      where: {
        lessonId: { in: lessonIds },
        completed: true,
      },
      _count: {
        id: true,
      },
    });

    // Map progress to users
    const leaderboard: LeaderboardEntry[] = enrollments.map((enrollment) => {
      const userProgress = progress.find((p) => p.userId === enrollment.userId);
      const completedLessons = userProgress?._count.id || 0;
      const progressPercentage =
        lessons.length > 0
          ? Math.round((completedLessons / lessons.length) * 100)
          : 0;

      return {
        rank: 0, // Will be set after sorting
        userId: enrollment.userId,
        user: enrollment.user,
        completedLessons,
        totalLessons: lessons.length,
        progress: progressPercentage,
        enrolledAt: enrollment.enrolledAt,
        lastActivity: enrollment.updatedAt,
      };
    });

    // Sort by completed lessons and progress
    leaderboard.sort((a, b) => {
      if (b.completedLessons !== a.completedLessons) {
        return b.completedLessons - a.completedLessons;
      }
      return b.progress - a.progress;
    });

    // Set ranks
    leaderboard.forEach((item, index) => {
      item.rank = index + 1;
    });

    return leaderboard.slice(0, limit);
  }

  async getLessonProgress(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Vérifier que l'utilisateur est inscrit au cours
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: lesson.module.course.id,
        },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException('You are not enrolled in this course');
    }

    const progress = await this.prisma.progress.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            module: {
              select: {
                id: true,
                title: true,
                courseId: true,
              },
            },
          },
        },
      },
    });

    return progress || { userId, lessonId, completed: false, timeSpent: 0 };
  }

  async getGlobalLeaderboard(
    period?: 'weekly' | 'monthly' | 'all',
    limit: number = 100,
  ): Promise<GlobalLeaderboardEntry[]> {
    // Définir la plage de dates en fonction de la période
    let dateFilter: Date | undefined;
    const now = new Date();
    if (period === 'weekly') {
      dateFilter = new Date(now.setDate(now.getDate() - 7));
    } else if (period === 'monthly') {
      dateFilter = new Date(now.setMonth(now.getMonth() - 1));
    }

    // Récupérer toutes les progressions (ou seulement celles de la période)
    const whereClause: Prisma.ProgressWhereInput = {};
    if (dateFilter) {
      whereClause.updatedAt = { gte: dateFilter };
    }

    // On utilise findMany pour obtenir les progressions avec les utilisateurs
    const progresses = await this.prisma.progress.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Agréger par utilisateur
    const userMap = new Map<
      string,
      {
        userId: string;
        username: string;
        avatar: string | null;
        completedLessons: number;
        streak: number;
        points: number;
        lastActivity: Date;
        updatedAt: Date;
      }
    >();

    for (const prog of progresses) {
      if (!prog.user) continue;
      const userId = prog.userId;
      let entry = userMap.get(userId);
      if (!entry) {
        entry = {
          userId,
          username: prog.user.username,
          avatar: prog.user.avatar,
          completedLessons: 0,
          streak: 0,
          points: 0,
          lastActivity: prog.updatedAt,
          updatedAt: prog.updatedAt,
        };
        userMap.set(userId, entry);
      }
      // maintenant entry est défini
      if (prog.completed) {
        entry.completedLessons += 1;
        entry.points += 10;
      }
      if (prog.updatedAt > entry.lastActivity) {
        entry.lastActivity = prog.updatedAt;
      }
    }

    // Convertir la map en tableau et trier
    let leaderboard = Array.from(userMap.values()).map((entry) => ({
      ...entry,
      rank: 0, // provisoire
    }));

    // Trier par points décroissants, puis par dernière activité
    leaderboard.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.lastActivity.getTime() - a.lastActivity.getTime();
    });

    // Assigner les rangs
    leaderboard = leaderboard.map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));

    // Limiter
    return leaderboard.slice(0, limit);
  }

  // src/progress/progress.service.ts
  async getAdminRecentActivities(
    limit: number = 20,
  ): Promise<AdminRecentActivityDto[]> {
    // Récupérer les dernières leçons complétées
    const completedLessons = await this.prisma.progress.findMany({
      where: { completed: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, username: true, avatar: true } },
        lesson: { select: { title: true } },
      },
    });

    // Récupérer les dernières inscriptions
    const enrollments = await this.prisma.enrollment.findMany({
      orderBy: { enrolledAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, username: true, avatar: true } },
        course: { select: { title: true } },
      },
    });

    // Récupérer les dernières soumissions
    const submissions = await this.prisma.submission.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, username: true, avatar: true } },
        exercise: { select: { title: true } },
      },
    });

    // Fusionner et trier par date
    const activities: AdminRecentActivityDto[] = [
      ...completedLessons.map((p) => ({
        id: p.id,
        userId: p.user.id,
        username: p.user.username,
        userAvatar: p.user.avatar || undefined,
        type: 'lesson_completed' as const,
        description: `a terminé la leçon "${p.lesson.title}"`,
        createdAt: p.updatedAt,
      })),
      ...enrollments.map((e) => ({
        id: e.id,
        userId: e.user.id,
        username: e.user.username,
        userAvatar: e.user.avatar || undefined,
        type: 'course_enrolled' as const,
        description: `s'est inscrit au cours "${e.course.title}"`,
        createdAt: e.enrolledAt,
      })),
      ...submissions.map((s) => ({
        id: s.id,
        userId: s.user.id,
        username: s.user.username,
        userAvatar: s.user.avatar || undefined,
        type: 'exercise_submitted' as const,
        description: `a soumis l'exercice "${s.exercise.title}"`,
        createdAt: s.createdAt,
      })),
    ];

    // Trier par date décroissante et limiter
    return activities
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}
