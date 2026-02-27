import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { CourseService } from '../course/course.service';
import { Prisma, Role, VideoType } from '@prisma/client';

@Injectable()
export class LessonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courseService: CourseService,
  ) {}

  async createLesson(
    moduleId: string,
    createLessonDto: CreateLessonDto,
    userId: string,
  ) {
    // Check module exists
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        course: true,
      },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    // Check user is instructor of the course or admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (module.course.instructorId !== userId && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to create lessons for this module',
      );
    }

    // Generate slug from title

    const title: string = createLessonDto.title ?? '';
    if (!title) {
      throw new BadRequestException('Title is required');
    }
    const slug = this.generateSlug(title);

    // Check if slug is unique
    const existingLesson = await this.prisma.lesson.findUnique({
      where: { slug },
    });

    if (existingLesson) {
      throw new BadRequestException('A lesson with this title already exists');
    }

    // Get the maximum order for this module
    const lastLesson = await this.prisma.lesson.findFirst({
      where: { moduleId },
      orderBy: { order: 'desc' },
    });

    const order = lastLesson ? lastLesson.order + 1 : 1;

    // Determine video type from URL
    let videoType: VideoType | null = null;

    const videoUrl: string | undefined = createLessonDto.videoUrl;
    if (videoUrl && typeof videoUrl === 'string') {
      videoType = this.detectVideoType(videoUrl);
    }

    // Create the lesson data explicitly with correct typing

    const content: string = createLessonDto.content ?? '';
    if (!content) {
      throw new BadRequestException('Content is required');
    }

    const lessonData: Prisma.LessonCreateInput = {
      title,
      slug,
      content,
      videoUrl: videoUrl ?? null,

      duration:
        typeof createLessonDto.duration === 'number'
          ? createLessonDto.duration
          : 0,

      isFree:
        typeof createLessonDto.isFree === 'boolean'
          ? createLessonDto.isFree
          : false,
      videoType,
      order,
      module: {
        connect: { id: moduleId },
      },
    };

    return this.prisma.lesson.create({
      data: lessonData,
      include: {
        module: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                instructorId: true,
              },
            },
          },
        },
        exercise: {
          select: {
            id: true,
            title: true,
            language: true,
            difficulty: true,
          },
        },
        _count: {
          select: {
            comments: true,
            progress: true,
          },
        },
      },
    });
  }

  async findAllLessons(moduleId: string, userId?: string) {
    // Check module exists
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        course: true,
      },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    // If user is not instructor or admin, check if course is published
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) throw new NotFoundException('User not found');

      if (
        module.course.instructorId !== userId &&
        user.role !== Role.ADMIN &&
        !module.course.isPublished
      ) {
        throw new ForbiddenException('Course is not published');
      }
    } else if (!module.course.isPublished) {
      throw new ForbiddenException('Course is not published');
    }

    return this.prisma.lesson.findMany({
      where: { moduleId },
      include: {
        exercise: {
          select: {
            id: true,
            title: true,
            language: true,
            difficulty: true,
          },
        },
        _count: {
          select: {
            comments: true,
            progress: true,
          },
        },
      },
      orderBy: {
        order: 'asc',
      },
    });
  }

  async findLessonByIdOrSlug(identifier: string, userId?: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
      },
      include: {
        module: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                isPublished: true,
                instructorId: true,
              },
            },
          },
        },
        exercise: {
          include: {
            _count: {
              select: {
                submissions: true,
              },
            },
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
            replies: {
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
                createdAt: 'asc',
              },
            },
          },
          where: {
            parentId: null,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            comments: true,
            progress: true,
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Check permissions
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (
        lesson.module.course.instructorId !== userId &&
        user.role !== Role.ADMIN &&
        !lesson.module.course.isPublished
      ) {
        throw new ForbiddenException('Lesson is not accessible');
      }
    } else if (!lesson.module.course.isPublished) {
      throw new ForbiddenException('Lesson is not published');
    }

    // Increment views
    await this.prisma.lesson.update({
      where: { id: lesson.id },
      data: { views: { increment: 1 } },
    });

    return lesson;
  }

  async updateLesson(
    lessonId: string,
    updateLessonDto: UpdateLessonDto,
    userId: string,
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

    // Check user is instructor of the course or admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (
      lesson.module.course.instructorId !== userId &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('You are not allowed to update this lesson');
    }

    // If title is being updated, generate new slug
    let slug = lesson.slug;
    if (updateLessonDto.title && updateLessonDto.title !== lesson.title) {
      slug = this.generateSlug(updateLessonDto.title);

      // Check if new slug is unique
      const existingLesson = await this.prisma.lesson.findUnique({
        where: { slug },
      });

      if (existingLesson && existingLesson.id !== lessonId) {
        throw new BadRequestException(
          'A lesson with this title already exists',
        );
      }
    }

    // Determine video type from URL
    let videoType = lesson.videoType;
    if (updateLessonDto.videoUrl !== undefined) {
      videoType = updateLessonDto.videoUrl
        ? this.detectVideoType(updateLessonDto.videoUrl)
        : null;
    }

    // Prepare update data explicitly
    const updateData: Prisma.LessonUpdateInput = {
      slug,
      videoType,
    };

    // Add only the fields that are provided
    if (updateLessonDto.title !== undefined) {
      updateData.title = updateLessonDto.title;
    }
    if (updateLessonDto.content !== undefined) {
      updateData.content = updateLessonDto.content;
    }
    if (updateLessonDto.videoUrl !== undefined) {
      updateData.videoUrl = updateLessonDto.videoUrl || null;
    }
    if (updateLessonDto.duration !== undefined) {
      updateData.duration = updateLessonDto.duration;
    }
    if (updateLessonDto.isFree !== undefined) {
      updateData.isFree = updateLessonDto.isFree;
    }

    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: updateData,
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
        exercise: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  async deleteLesson(lessonId: string, userId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: true,
          },
        },
        exercise: true, // Include exercise to check if it exists
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    // Check user is instructor of the course or admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (
      lesson.module.course.instructorId !== userId &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('You are not allowed to delete this lesson');
    }

    // Delete associated exercise if exists
    if (lesson.exercise) {
      await this.prisma.exercise.delete({
        where: { lessonId: lessonId },
      });
    }

    await this.prisma.lesson.delete({
      where: { id: lessonId },
    });
  }

  async reorderLessons(moduleId: string, lessonIds: string[], userId: string) {
    // Check module exists
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        course: true,
      },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    // Check user is instructor of the course or admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (module.course.instructorId !== userId && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You are not allowed to reorder lessons');
    }

    // Verify all lessons belong to the module
    const lessons = await this.prisma.lesson.findMany({
      where: {
        id: { in: lessonIds },
        moduleId,
      },
    });

    if (lessons.length !== lessonIds.length) {
      throw new BadRequestException(
        'Some lessons do not belong to this module',
      );
    }

    // Update order for each lesson
    const updates = lessonIds.map((id, index) =>
      this.prisma.lesson.update({
        where: { id },
        data: { order: index + 1 },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.findAllLessons(moduleId, userId);
  }

  async markAsCompleted(lessonId: string, userId: string, timeSpent?: number) {
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

    // Vérifier si l'utilisateur est inscrit au cours
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

    // Si timeSpent n'est pas fourni, utiliser la durée de la leçon (en minutes converties en secondes)
    const timeSpentToAdd = timeSpent ?? lesson.duration * 60;

    // Mettre à jour ou créer la progression de la leçon avec upsert
    const progress = await this.prisma.progress.upsert({
      where: {
        userId_lessonId: { userId, lessonId },
      },
      update: {
        completed: true,
        completedAt: new Date(),
        timeSpent: { increment: timeSpentToAdd },
      },
      create: {
        userId,
        lessonId,
        completed: true,
        completedAt: new Date(),
        timeSpent: timeSpentToAdd,
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

    // Recalculer la progression globale du cours
    await this.courseService.updateCourseProgress(
      userId,
      lesson.module.course.id,
    );

    return progress;
  }

  async updateVideoPosition(
    lessonId: string,
    userId: string,
    position: number,
  ) {
    const progress = await this.prisma.progress.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
    });

    if (!progress) {
      return this.prisma.progress.create({
        data: {
          userId,
          lessonId,
          lastPosition: position,
        },
      });
    }

    return this.prisma.progress.update({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
      data: {
        lastPosition: position,
      },
    });
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim();
  }

  private detectVideoType(url: string): VideoType {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return VideoType.YOUTUBE;
    } else if (url.includes('vimeo.com')) {
      return VideoType.VIMEO;
    } else {
      return VideoType.UPLOADED;
    }
  }
}
