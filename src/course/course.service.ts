import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseFilterDto } from './dto/course-filter.dto';
import { Role, Prisma } from '@prisma/client';

@Injectable()
export class CourseService {
  constructor(private readonly prisma: PrismaService) {}

  async createCourse(userId: string, createCourseDto: CreateCourseDto) {
    // Check that user is instructor or admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user.role !== Role.INSTRUCTOR && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only instructors and admins can create courses',
      );
    }

    const { tags, ...courseData } = createCourseDto;

    // Create course data with proper Prisma types
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

    return this.prisma.course.create({
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
  }

  async findAllCourses(filter: CourseFilterDto) {
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

    return {
      data: courses.map((course) => ({
        ...course,
        totalLessons: course.modules.reduce(
          (acc, module) => acc + module.lessons.length,
          0,
        ),
        totalEnrollments: course.enrollments.length,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findCourseByIdOrSlug(identifier: string) {
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
      throw new NotFoundException('Course not found');
    }

    return {
      ...course,
      totalLessons: course.modules.reduce(
        (acc, module) => acc + module.lessons.length,
        0,
      ),
      totalStudents: course.enrollments.length,
    };
  }

  async updateCourse(
    userId: string,
    courseId: string,
    updateCourseDto: UpdateCourseDto,
  ) {
    // Check that course exists and user is instructor or admin
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (course.instructorId !== userId && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You are not allowed to update this course');
    }

    const { tags, ...updateData } = updateCourseDto;

    const updateCourseData: Prisma.CourseUpdateInput = {
      ...updateData,
    };

    // Handle tags update if provided
    if (tags) {
      // First delete existing tags
      await this.prisma.courseTag.deleteMany({
        where: { courseId },
      });

      // Then create new ones
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

    return updatedCourse;
  }

  async deleteCourse(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (course.instructorId !== userId && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You are not allowed to delete this course');
    }

    await this.prisma.course.delete({
      where: { id: courseId },
    });
  }

  async publishCourse(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (course.instructorId !== userId && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to publish this course',
      );
    }

    return this.prisma.course.update({
      where: { id: courseId },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });
  }

  async unpublishCourse(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (course.instructorId !== userId && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to unpublish this course',
      );
    }

    return this.prisma.course.update({
      where: { id: courseId },
      data: {
        isPublished: false,
      },
    });
  }

  async enrollInCourse(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (!course.isPublished) {
      throw new BadRequestException('Course is not published');
    }

    // Check if already enrolled
    const existingEnrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (existingEnrollment) {
      throw new BadRequestException('Already enrolled in this course');
    }

    return this.prisma.enrollment.create({
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
  }

  async unenrollFromCourse(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
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
  }

  async getUserEnrollments(userId: string) {
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

    return enrollments.map((enrollment) => ({
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
  }

  async updateEnrollmentProgress(
    userId: string,
    courseId: string,
    progress: number,
  ) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    const updatedProgress = Math.min(Math.max(progress, 0), 100);
    const completed = updatedProgress === 100;

    return this.prisma.enrollment.update({
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
  }

  async getCourseEnrollments(courseId: string, userId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Check that user is instructor or admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (course.instructorId !== userId && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to view enrollments for this course',
      );
    }

    return this.prisma.enrollment.findMany({
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
  }
}
