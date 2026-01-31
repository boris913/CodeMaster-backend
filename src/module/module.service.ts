import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { Prisma, Role } from '@prisma/client';

@Injectable()
export class ModuleService {
  constructor(private readonly prisma: PrismaService) {}

  async createModule(
    courseId: string,
    createModuleDto: CreateModuleDto,
    userId: string,
  ) {
    // Check course exists
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Check user is instructor of the course or admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (course.instructorId !== userId && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'You are not allowed to create modules for this course',
      );
    }

    // Get the maximum order for this course
    const lastModule = await this.prisma.module.findFirst({
      where: { courseId },
      orderBy: { order: 'desc' },
    });

    const order = lastModule ? lastModule.order + 1 : 1;

    return this.prisma.module.create({
      data: {
        ...createModuleDto,
        courseId,
        order,
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            instructorId: true,
          },
        },
        lessons: {
          select: {
            id: true,
            title: true,
            order: true,
            duration: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });
  }

  async findAllModules(courseId: string, userId?: string) {
    // Check course exists
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // If user is not instructor or admin, check if course is published
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (
        course.instructorId !== userId &&
        user.role !== Role.ADMIN &&
        !course.isPublished
      ) {
        throw new ForbiddenException('Course is not published');
      }
    } else if (!course.isPublished) {
      throw new ForbiddenException('Course is not published');
    }

    return this.prisma.module.findMany({
      where: { courseId },
      include: {
        lessons: {
          select: {
            id: true,
            title: true,
            slug: true,
            duration: true,
            order: true,
            isFree: true,
            _count: {
              select: {
                comments: true,
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
        _count: {
          select: {
            lessons: true,
          },
        },
      },
      orderBy: {
        order: 'asc',
      },
    });
  }

  async findModuleById(moduleId: string, userId?: string) {
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            isPublished: true,
            instructorId: true,
          },
        },
        lessons: {
          select: {
            id: true,
            title: true,
            slug: true,
            content: true,
            videoUrl: true,
            videoType: true,
            duration: true,
            order: true,
            isFree: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                comments: true,
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    // Check permissions
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (
        module.course.instructorId !== userId &&
        user.role !== Role.ADMIN &&
        !module.course.isPublished
      ) {
        throw new ForbiddenException('Module is not accessible');
      }
    } else if (!module.course.isPublished) {
      throw new ForbiddenException('Module is not published');
    }

    return module;
  }

  async updateModule(
    moduleId: string,
    updateModuleDto: UpdateModuleDto,
    userId: string,
  ) {
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
      throw new ForbiddenException('You are not allowed to update this module');
    }

    // Create update data with explicit typing
    const updateData: Prisma.ModuleUpdateInput = {
      ...(updateModuleDto.title !== undefined && {
        title: updateModuleDto.title,
      }),

      ...(updateModuleDto.description !== undefined && {
        description: updateModuleDto.description,
      }),

      ...(updateModuleDto.duration !== undefined && {
        duration: updateModuleDto.duration,
      }),
    };

    return this.prisma.module.update({
      where: { id: moduleId },
      data: updateData,
      include: {
        course: {
          select: {
            id: true,
            title: true,
          },
        },
        lessons: {
          select: {
            id: true,
            title: true,
            order: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });
  }

  async deleteModule(moduleId: string, userId: string) {
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
      throw new ForbiddenException('You are not allowed to delete this module');
    }

    // Delete all lessons in this module first
    await this.prisma.lesson.deleteMany({
      where: { moduleId },
    });

    await this.prisma.module.delete({
      where: { id: moduleId },
    });
  }

  async reorderModules(courseId: string, moduleIds: string[], userId: string) {
    // Check course exists
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Check user is instructor of the course or admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (course.instructorId !== userId && user.role !== Role.ADMIN) {
      throw new ForbiddenException('You are not allowed to reorder modules');
    }

    // Verify all modules belong to the course
    const modules = await this.prisma.module.findMany({
      where: {
        id: { in: moduleIds },
        courseId,
      },
    });

    if (modules.length !== moduleIds.length) {
      throw new BadRequestException(
        'Some modules do not belong to this course',
      );
    }

    // Update order for each module
    const updates = moduleIds.map((id, index) =>
      this.prisma.module.update({
        where: { id },
        data: { order: index + 1 },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.findAllModules(courseId, userId);
  }

  async calculateModuleDuration(moduleId: string) {
    const lessons = await this.prisma.lesson.findMany({
      where: { moduleId },
      select: { duration: true },
    });

    const totalDuration = lessons.reduce(
      (sum, lesson) => sum + lesson.duration,
      0,
    );

    await this.prisma.module.update({
      where: { id: moduleId },
      data: { duration: totalDuration },
    });

    return totalDuration;
  }
}
