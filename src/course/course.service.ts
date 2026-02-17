// src/course/course.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseFilterDto } from './dto/course-filter.dto';
import { CourseAnalyticsDto } from './dto/course-analytics.dto';
import { Role, Prisma } from '@prisma/client';

@Injectable()
export class CourseService {
  private readonly logger = new Logger(CourseService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createCourse(userId: string, createCourseDto: CreateCourseDto) {
    this.logger.log(`Creating course for user ${userId}`, {
      userId,
      title: createCourseDto.title,
    });

    // Check that user is instructor or admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      this.logger.warn(`User not found during course creation: ${userId}`);
      throw new NotFoundException('User not found');
    }

    if (user.role !== Role.INSTRUCTOR && user.role !== Role.ADMIN) {
      this.logger.warn(
        `User ${userId} with role ${user.role} attempted to create a course`,
      );
      throw new ForbiddenException(
        'Only instructors and admins can create courses',
      );
    }

    const { tags, ...courseData } = createCourseDto;

    const courseCreateData: Prisma.CourseCreateInput = {
      ...courseData,
      instructor: {
        connect: { id: userId },
      },
      ...(tags && tags.length > 0
        ? {
            tags: {
              create: tags.map((tag) => ({ name: tag })),
            },
          }
        : {}),
    };

    const course = await this.prisma.course.create({
      data: courseCreateData,
      include: {
        tags: true,
        instructor: {
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

    this.logger.log(`Course created successfully: ${course.id}`, {
      courseId: course.id,
      userId,
    });
    return course;
  }

  async findAllCourses(filter: CourseFilterDto) {
    this.logger.log('Finding all courses with filters', { filter });

    const {
      search,
      difficulty,
      instructorId,
      isPublished,
      isFeatured,
      tags,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filter;

    const where: Prisma.CourseWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { shortDescription: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (instructorId) {
      where.instructorId = instructorId;
    }

    if (isPublished !== undefined) {
      where.isPublished = isPublished;
    }

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

    if (tags && tags.length > 0) {
      where.tags = {
        some: {
          name: {
            in: tags,
          },
        },
      };
    }

    const orderBy: Prisma.CourseOrderByWithRelationInput = {};
    if (sortBy === 'title') orderBy.title = sortOrder;
    else if (sortBy === 'rating') orderBy.rating = sortOrder;
    else if (sortBy === 'totalStudents') orderBy.totalStudents = sortOrder;
    else orderBy.createdAt = sortOrder;

    const [courses, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          tags: true,
          instructor: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          modules: {
            include: {
              lessons: {
                select: {
                  id: true,
                },
              },
            },
          },
          enrollments: {
            select: {
              id: true,
            },
          },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    const result = courses.map((course) => ({
      ...course,
      totalLessons: course.modules.reduce(
        (acc, module) => acc + module.lessons.length,
        0,
      ),
      totalEnrollments: course.enrollments.length,
    }));

    this.logger.log(`Found ${total} courses`, { total, page, limit });
    return {
      data: result,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findCourseByIdOrSlug(identifier: string) {
    this.logger.log(`Finding course by identifier: ${identifier}`);

    const course = await this.prisma.course.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
      },
      include: {
        tags: true,
        instructor: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
          },
        },
        modules: {
          include: {
            lessons: {
              select: {
                id: true,
                title: true,
                slug: true,
                duration: true,
                order: true,
                isFree: true,
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
        enrollments: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!course) {
      this.logger.warn(`Course not found: ${identifier}`);
      throw new NotFoundException('Course not found');
    }

    const result = {
      ...course,
      totalLessons: course.modules.reduce(
        (acc, module) => acc + module.lessons.length,
        0,
      ),
      totalStudents: course.enrollments.length,
    };

    this.logger.log(`Course found: ${course.id}`, { courseId: course.id });
    return result;
  }

  async updateCourse(
    userId: string,
    courseId: string,
    updateCourseDto: UpdateCourseDto,
  ) {
    this.logger.log(`Updating course ${courseId} by user ${userId}`);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      this.logger.warn(`Course not found for update: ${courseId}`);
      throw new NotFoundException('Course not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      this.logger.warn(`User not found during course update: ${userId}`);
      throw new NotFoundException('User not found');
    }

    if (course.instructorId !== userId && user.role !== Role.ADMIN) {
      this.logger.warn(
        `User ${userId} attempted to update course ${courseId} without permission`,
      );
      throw new ForbiddenException('You are not allowed to update this course');
    }

    const { tags, ...updateData } = updateCourseDto;

    const updateCourseData: Prisma.CourseUpdateInput = {
      ...updateData,
    };

    if (tags) {
      await this.prisma.courseTag.deleteMany({
        where: { courseId },
      });

      updateCourseData.tags = {
        create: tags.map((tag) => ({ name: tag })),
      };
    }

    const updatedCourse = await this.prisma.course.update({
      where: { id: courseId },
      data: updateCourseData,
      include: {
        tags: true,
        instructor: {
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

    this.logger.log(`Course ${courseId} updated successfully`, {
      courseId,
      userId,
    });
    return updatedCourse;
  }

  async deleteCourse(userId: string, courseId: string) {
    this.logger.log(`Deleting course ${courseId} by user ${userId}`);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      this.logger.warn(`Course not found for deletion: ${courseId}`);
      throw new NotFoundException('Course not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      this.logger.warn(`User not found during course deletion: ${userId}`);
      throw new NotFoundException('User not found');
    }

    if (course.instructorId !== userId && user.role !== Role.ADMIN) {
      this.logger.warn(
        `User ${userId} attempted to delete course ${courseId} without permission`,
      );
      throw new ForbiddenException('You are not allowed to delete this course');
    }

    await this.prisma.course.delete({
      where: { id: courseId },
    });

    this.logger.log(`Course ${courseId} deleted successfully`, {
      courseId,
      userId,
    });
  }

  async publishCourse(userId: string, courseId: string) {
    this.logger.log(`Publishing course ${courseId} by user ${userId}`);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      this.logger.warn(`Course not found for publish: ${courseId}`);
      throw new NotFoundException('Course not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      this.logger.warn(`User not found during publish: ${userId}`);
      throw new NotFoundException('User not found');
    }

    if (course.instructorId !== userId && user.role !== Role.ADMIN) {
      this.logger.warn(
        `User ${userId} attempted to publish course ${courseId} without permission`,
      );
      throw new ForbiddenException(
        'You are not allowed to publish this course',
      );
    }

    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    this.logger.log(`Course ${courseId} published`, { courseId, userId });
    return updated;
  }

  async unpublishCourse(userId: string, courseId: string) {
    this.logger.log(`Unpublishing course ${courseId} by user ${userId}`);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      this.logger.warn(`Course not found for unpublish: ${courseId}`);
      throw new NotFoundException('Course not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      this.logger.warn(`User not found during unpublish: ${userId}`);
      throw new NotFoundException('User not found');
    }

    if (course.instructorId !== userId && user.role !== Role.ADMIN) {
      this.logger.warn(
        `User ${userId} attempted to unpublish course ${courseId} without permission`,
      );
      throw new ForbiddenException(
        'You are not allowed to unpublish this course',
      );
    }

    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: {
        isPublished: false,
      },
    });

    this.logger.log(`Course ${courseId} unpublished`, { courseId, userId });
    return updated;
  }

  async enrollInCourse(userId: string, courseId: string) {
    this.logger.log(`Enrolling user ${userId} in course ${courseId}`);

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      this.logger.warn(`Course not found for enrollment: ${courseId}`);
      throw new NotFoundException('Course not found');
    }

    if (!course.isPublished) {
      this.logger.warn(
        `Attempted enrollment in unpublished course ${courseId}`,
      );
      throw new BadRequestException('Course is not published');
    }

    const existingEnrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (existingEnrollment) {
      this.logger.warn(`User ${userId} already enrolled in course ${courseId}`);
      throw new BadRequestException('Already enrolled in this course');
    }

    const enrollment = await this.prisma.enrollment.create({
      data: {
        userId,
        courseId,
      },
      include: {
        course: {
          include: {
            instructor: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(`User ${userId} enrolled in course ${courseId}`, {
      enrollmentId: enrollment.id,
    });
    return enrollment;
  }

  async unenrollFromCourse(userId: string, courseId: string) {
    this.logger.log(`Unenrolling user ${userId} from course ${courseId}`);

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      this.logger.warn(
        `Enrollment not found for user ${userId} course ${courseId}`,
      );
      throw new NotFoundException('Enrollment not found');
    }

    await this.prisma.enrollment.delete({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    this.logger.log(`User ${userId} unenrolled from course ${courseId}`);
  }

  async getUserEnrollments(userId: string) {
    this.logger.log(`Fetching enrollments for user ${userId}`);

    const enrollments = await this.prisma.enrollment.findMany({
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
            modules: {
              include: {
                lessons: {
                  select: {
                    id: true,
                  },
                },
              },
            },
            enrollments: {
              select: {
                id: true,
              },
            },
          },
        },
      },
      orderBy: {
        enrolledAt: 'desc',
      },
    });

    const result = enrollments.map((enrollment) => ({
      ...enrollment,
      course: {
        ...enrollment.course,
        totalLessons: enrollment.course.modules.reduce(
          (acc, module) => acc + module.lessons.length,
          0,
        ),
        totalEnrollments: enrollment.course.enrollments.length,
      },
    }));

    this.logger.log(`Found ${result.length} enrollments for user ${userId}`);
    return result;
  }

  async updateEnrollmentProgress(
    userId: string,
    courseId: string,
    progress: number,
  ) {
    this.logger.log(
      `Updating progress for user ${userId} in course ${courseId}`,
      {
        progress,
      },
    );

    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      this.logger.warn(
        `Enrollment not found for progress update: user ${userId} course ${courseId}`,
      );
      throw new NotFoundException('Enrollment not found');
    }

    const updatedProgress = Math.min(Math.max(progress, 0), 100);
    const completed = updatedProgress === 100;

    const updated = await this.prisma.enrollment.update({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
      data: {
        progress: updatedProgress,
        completed,
        completedAt: completed ? new Date() : null,
      },
    });

    this.logger.log(
      `Progress updated for user ${userId} in course ${courseId}`,
      {
        progress: updatedProgress,
        completed,
      },
    );
    return updated;
  }

  async getCourseEnrollments(courseId: string, userId: string) {
    this.logger.log(
      `Fetching enrollments for course ${courseId} by user ${userId}`,
    );

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      this.logger.warn(`Course not found for enrollments: ${courseId}`);
      throw new NotFoundException('Course not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      this.logger.warn(`User not found while fetching enrollments: ${userId}`);
      throw new NotFoundException('User not found');
    }

    if (course.instructorId !== userId && user.role !== Role.ADMIN) {
      this.logger.warn(
        `User ${userId} attempted to view enrollments of course ${courseId} without permission`,
      );
      throw new ForbiddenException(
        'You are not allowed to view enrollments for this course',
      );
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            lastLogin: true,
          },
        },
      },
      orderBy: {
        enrolledAt: 'desc',
      },
    });

    this.logger.log(
      `Found ${enrollments.length} enrollments for course ${courseId}`,
    );
    return enrollments;
  }

  async getCourseAnalytics(
    courseId: string,
    userId: string,
  ): Promise<CourseAnalyticsDto> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          include: {
            lessons: true,
          },
        },
        enrollments: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Vérification des droits
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (course.instructorId !== userId && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to view analytics for this course',
      );
    }

    // Calculs
    const totalEnrollments = course.enrollments.length;
    const completedEnrollments = course.enrollments.filter(
      (e) => e.completed,
    ).length;
    const completionRate =
      totalEnrollments > 0
        ? (completedEnrollments / totalEnrollments) * 100
        : 0;

    // Progressions des leçons
    const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const progress = await this.prisma.progress.findMany({
      where: {
        lessonId: { in: lessonIds },
        completed: true,
      },
    });

    const totalTimeSpentSeconds = progress.reduce(
      (acc, p) => acc + p.timeSpent,
      0,
    );
    const totalTimeSpent = Math.round(totalTimeSpentSeconds / 60);

    // Tendance des inscriptions (par jour)
    const enrollmentTrend = course.enrollments
      .map((e) => e.enrolledAt.toISOString().split('T')[0])
      .reduce(
        (acc, date) => {
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
    const trendArray = Object.entries(enrollmentTrend)
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => a.period.localeCompare(b.period));

    // Taux de complétion par module
    const moduleCompletion = await Promise.all(
      course.modules.map(async (module) => {
        const moduleLessonIds = module.lessons.map((l) => l.id);
        const completedCount = await this.prisma.progress.count({
          where: {
            lessonId: { in: moduleLessonIds },
            completed: true,
          },
        });
        const totalPossible = moduleLessonIds.length * totalEnrollments;
        const rate =
          totalPossible > 0 ? (completedCount / totalPossible) * 100 : 0;
        return {
          moduleId: module.id,
          title: module.title,
          completionRate: Math.round(rate),
        };
      }),
    );

    return {
      totalEnrollments,
      completedEnrollments,
      completionRate: Math.round(completionRate),
      averageRating: course.rating,
      totalTimeSpent,
      enrollmentTrend: trendArray,
      moduleCompletion,
    };
  }
}
