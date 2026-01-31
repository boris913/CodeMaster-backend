import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UsersFilterDto } from './dto/users-filter.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { Role, Prisma, User, SubmissionStatus } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface UserStats {
  userId: string;
  coursesEnrolled: number;
  coursesCompleted: number;
  totalSubmissions: number;
  successfulSubmissions: number;
  averageExerciseScore: number;
  totalTimeSpent: number;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const stats = await this.getUserStats(userId);
    return this.mapToUserResponseDto(user, stats);
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check username uniqueness if being updated
    if (
      updateProfileDto.username &&
      updateProfileDto.username !== user.username
    ) {
      const existingUser = await this.prisma.user.findUnique({
        where: { username: updateProfileDto.username, deletedAt: null },
      });

      if (existingUser) {
        throw new BadRequestException('Username already taken');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateProfileDto,
    });

    const stats = await this.getUserStats(userId);
    return this.mapToUserResponseDto(updatedUser, stats);
  }

  async findAllUsers(
    filter: UsersFilterDto,
    requesterId: string,
  ): Promise<PaginatedResponse<UserResponseDto>> {
    // Check if requester is admin
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });

    if (!requester || requester.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can view all users');
    }

    const where: Prisma.UserWhereInput = { deletedAt: null };

    if (filter.search) {
      where.OR = [
        { email: { contains: filter.search, mode: 'insensitive' } },
        { username: { contains: filter.search, mode: 'insensitive' } },
        { firstName: { contains: filter.search, mode: 'insensitive' } },
        { lastName: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter.role) {
      where.role = filter.role;
    }

    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter.emailVerified !== undefined) {
      where.emailVerified = filter.emailVerified;
    }

    const orderBy: Prisma.UserOrderByWithRelationInput = {};
    if (filter.sortBy === 'username') orderBy.username = filter.sortOrder;
    else if (filter.sortBy === 'email') orderBy.email = filter.sortOrder;
    else if (filter.sortBy === 'lastLogin')
      orderBy.lastLogin = filter.sortOrder;
    else orderBy.createdAt = filter.sortOrder;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const stats = await this.getUserStats(user.id);
        return this.mapToUserResponseDto(user, stats);
      }),
    );

    return {
      data: usersWithStats,
      meta: {
        total,
        page: filter.page,
        limit: filter.limit,
        totalPages: Math.ceil(total / filter.limit),
      },
    };
  }

  async findUserById(
    userId: string,
    requesterId: string,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check permissions: user can view their own profile, admins can view any
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });

    if (!requester) {
      throw new NotFoundException('Requester not found');
    }

    if (user.id !== requesterId && requester.role !== Role.ADMIN) {
      throw new ForbiddenException('You can only view your own profile');
    }

    const stats = await this.getUserStats(userId);
    return this.mapToUserResponseDto(user, stats);
  }

  async updateUserRole(
    userId: string,
    updateUserRoleDto: UpdateUserRoleDto,
    requesterId: string,
  ): Promise<UserResponseDto> {
    // Check if requester is admin
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });

    if (!requester || requester.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can update user roles');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent admins from modifying themselves
    if (user.id === requesterId) {
      throw new BadRequestException(
        'You cannot modify your own role or status',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateUserRoleDto,
    });

    const stats = await this.getUserStats(userId);
    return this.mapToUserResponseDto(updatedUser, stats);
  }

  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate file
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB
      throw new BadRequestException('File size must be less than 5MB');
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const uploadPath = path.join('uploads', 'avatars', fileName);

    try {
      // Ensure upload directory exists
      await fs.mkdir(path.dirname(uploadPath), { recursive: true });

      // Save file
      await fs.writeFile(uploadPath, file.buffer);

      // Delete old avatar if exists
      if (user.avatar) {
        const oldAvatarPath = path.join(
          'uploads',
          'avatars',
          path.basename(user.avatar),
        );
        try {
          await fs.unlink(oldAvatarPath);
        } catch {
          // Ignore if file doesn't exist
        }
      }

      // Update user with new avatar URL
      const avatarUrl = `/uploads/avatars/${fileName}`;
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { avatar: avatarUrl },
      });

      const stats = await this.getUserStats(userId);
      return this.mapToUserResponseDto(updatedUser, stats);
    } catch {
      throw new InternalServerErrorException('Failed to upload avatar');
    }
  }

  async deleteAvatar(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.avatar) {
      throw new BadRequestException('User does not have an avatar');
    }

    // Delete avatar file
    const avatarPath = path.join(
      'uploads',
      'avatars',
      path.basename(user.avatar),
    );
    try {
      await fs.unlink(avatarPath);
    } catch {
      // Ignore if file doesn't exist
    }

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
    });

    const stats = await this.getUserStats(userId);
    return this.mapToUserResponseDto(updatedUser, stats);
  }

  async softDeleteUser(userId: string, requesterId: string): Promise<void> {
    // Check if requester is admin
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });

    if (!requester || requester.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can delete users');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent admins from deleting themselves
    if (user.id === requesterId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    // Soft delete: mark as deleted and deactivate
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        isActive: false,
        email: `deleted_${Date.now()}_${user.email}`, // Prevent email reuse
        username: `deleted_${Date.now()}_${user.username}`, // Prevent username reuse
      },
    });

    // Invalidate all refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  }

  async getUserStats(userId: string): Promise<UserStats> {
    const [enrollments, submissions, progress] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { userId },
        include: { course: true },
      }),
      this.prisma.submission.findMany({
        where: { userId },
      }),
      this.prisma.progress.findMany({
        where: { userId, completed: true },
        include: { lesson: true },
      }),
    ]);

    const coursesEnrolled = enrollments.length;
    const coursesCompleted = enrollments.filter((e) => e.completed).length;
    const totalSubmissions = submissions.length;

    const successfulSubmissions = submissions.filter(
      (s) => s.status === SubmissionStatus.SUCCESS,
    ).length;

    const averageExerciseScore =
      totalSubmissions > 0
        ? Math.round((successfulSubmissions / totalSubmissions) * 100)
        : 0;

    // Calculate total time spent on lessons (in minutes)
    const totalTimeSpent = progress.reduce(
      (sum, p) => sum + Math.floor(p.timeSpent / 60),
      0,
    );

    return {
      userId,
      coursesEnrolled,
      coursesCompleted,
      totalSubmissions,
      successfulSubmissions,
      averageExerciseScore,
      totalTimeSpent,
    };
  }

  async getUserEnrollments(userId: string, page: number, limit: number) {
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
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { enrolledAt: 'desc' },
    });

    const total = await this.prisma.enrollment.count({
      where: { userId },
    });

    return {
      data: enrollments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserSubmissions(
    userId: string,
    page: number,
    limit: number,
    status?: SubmissionStatus,
  ) {
    const where: Prisma.SubmissionWhereInput = { userId };
    if (status) {
      where.status = status;
    }

    const submissions = await this.prisma.submission.findMany({
      where,
      include: {
        exercise: {
          include: {
            lesson: {
              include: {
                module: {
                  include: {
                    course: true,
                  },
                },
              },
            },
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const total = await this.prisma.submission.count({ where });

    return {
      data: submissions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private mapToUserResponseDto(user: User, stats?: UserStats): UserResponseDto {
    const dto = new UserResponseDto();

    dto.id = user.id;
    dto.email = user.email;
    dto.username = user.username;
    dto.firstName = user.firstName || undefined;
    dto.lastName = user.lastName || undefined;
    dto.avatar = user.avatar || undefined;
    dto.bio = user.bio || undefined;
    dto.role = user.role;
    dto.isActive = user.isActive;
    dto.emailVerified = user.emailVerified;
    dto.lastLogin = user.lastLogin || undefined;
    dto.githubId = user.githubId || undefined;
    dto.googleId = user.googleId || undefined;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    dto.deletedAt = user.deletedAt || undefined;

    if (stats) {
      dto.stats = {
        coursesEnrolled: stats.coursesEnrolled,
        coursesCompleted: stats.coursesCompleted,
        totalSubmissions: stats.totalSubmissions,
        averageExerciseScore: stats.averageExerciseScore,
      };
    }

    return dto;
  }
}
