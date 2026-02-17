import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UsersFilterDto } from './dto/users-filter.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { Role, Prisma, User, SubmissionStatus } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

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
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    this.logger.log(`Fetching current user: ${userId}`);
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new NotFoundException('User not found');
    }

    const stats = await this.getUserStats(userId);
    return this.mapToUserResponseDto(user, stats);
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    this.logger.log(`Updating profile for user: ${userId}`);
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      this.logger.warn(`User not found for update: ${userId}`);
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
        this.logger.warn(
          `Username already taken: ${updateProfileDto.username}`,
        );
        throw new BadRequestException('Username already taken');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateProfileDto,
    });

    this.logger.log(`Profile updated for user: ${userId}`);
    const stats = await this.getUserStats(userId);
    return this.mapToUserResponseDto(updatedUser, stats);
  }

  async findAllUsers(
    filter: UsersFilterDto,
    requesterId: string,
  ): Promise<PaginatedResponse<UserResponseDto>> {
    this.logger.log(
      `Admin ${requesterId} fetching all users with filter: ${JSON.stringify(filter)}`,
    );
    // Check if requester is admin
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });

    if (!requester || requester.role !== Role.ADMIN) {
      this.logger.warn(
        `User ${requesterId} attempted to view all users without admin role`,
      );
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

    this.logger.log(`Found ${users.length} users (total ${total})`);

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
    this.logger.log(`User ${requesterId} fetching user by id: ${userId}`);
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new NotFoundException('User not found');
    }

    // Check permissions: user can view their own profile, admins can view any
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });

    if (!requester) {
      this.logger.warn(`Requester not found: ${requesterId}`);
      throw new NotFoundException('Requester not found');
    }

    if (user.id !== requesterId && requester.role !== Role.ADMIN) {
      this.logger.warn(
        `User ${requesterId} attempted to view another user's profile without admin role`,
      );
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
    this.logger.log(`Admin ${requesterId} updating role for user: ${userId}`);
    // Check if requester is admin
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });

    if (!requester || requester.role !== Role.ADMIN) {
      this.logger.warn(
        `User ${requesterId} attempted to update role without admin role`,
      );
      throw new ForbiddenException('Only admins can update user roles');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      this.logger.warn(`User not found for role update: ${userId}`);
      throw new NotFoundException('User not found');
    }

    // Prevent admins from modifying themselves
    if (user.id === requesterId) {
      this.logger.warn(`Admin attempted to modify own role/status`);
      throw new BadRequestException(
        'You cannot modify your own role or status',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateUserRoleDto,
    });

    this.logger.log(
      `User role updated: ${userId} -> ${JSON.stringify(updateUserRoleDto)}`,
    );
    const stats = await this.getUserStats(userId);
    return this.mapToUserResponseDto(updatedUser, stats);
  }

  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<UserResponseDto> {
    this.logger.log(`Uploading avatar for user: ${userId}`);
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      this.logger.warn(`User not found for avatar upload: ${userId}`);
      throw new NotFoundException('User not found');
    }

    // Validation supplémentaire (redondante mais sécuritaire)
    if (!file.mimetype.startsWith('image/')) {
      this.logger.warn(`Invalid file type for avatar: ${file.mimetype}`);
      throw new BadRequestException('File must be an image');
    }
    if (file.size > 5 * 1024 * 1024) {
      this.logger.warn(`File too large for avatar: ${file.size} bytes`);
      throw new BadRequestException('File size must be less than 5MB');
    }

    // Supprimer l'ancien avatar si existant
    if (user.avatar) {
      const oldAvatarPath = path.join(
        'uploads',
        'avatars',
        path.basename(user.avatar),
      );
      try {
        await fs.unlink(oldAvatarPath);
        this.logger.debug(`Old avatar deleted: ${oldAvatarPath}`);
      } catch {
        // Ignorer si le fichier n'existe pas
      }
    }

    // URL publique basée sur le nom généré par Multer
    const avatarUrl = `/uploads/avatars/${file.filename}`;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
    });

    this.logger.log(`Avatar uploaded successfully for user: ${userId}`);
    const stats = await this.getUserStats(userId);
    return this.mapToUserResponseDto(updatedUser, stats);
  }

  async deleteAvatar(userId: string): Promise<UserResponseDto> {
    this.logger.log(`Deleting avatar for user: ${userId}`);
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      this.logger.warn(`User not found for avatar deletion: ${userId}`);
      throw new NotFoundException('User not found');
    }

    if (!user.avatar) {
      this.logger.warn(`User ${userId} has no avatar to delete`);
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
      this.logger.debug(`Avatar file deleted: ${avatarPath}`);
    } catch {
      this.logger.warn(`Failed to delete avatar file`);
      // Ignore if file doesn't exist
    }

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
    });

    this.logger.log(`Avatar deleted for user: ${userId}`);
    const stats = await this.getUserStats(userId);
    return this.mapToUserResponseDto(updatedUser, stats);
  }

  async softDeleteUser(userId: string, requesterId: string): Promise<void> {
    this.logger.log(`Admin ${requesterId} soft deleting user: ${userId}`);
    // Check if requester is admin
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });

    if (!requester || requester.role !== Role.ADMIN) {
      this.logger.warn(
        `User ${requesterId} attempted to delete user without admin role`,
      );
      throw new ForbiddenException('Only admins can delete users');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      this.logger.warn(`User not found for deletion: ${userId}`);
      throw new NotFoundException('User not found');
    }

    // Prevent admins from deleting themselves
    if (user.id === requesterId) {
      this.logger.warn(`Admin attempted to delete own account`);
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
    this.logger.log(`User soft deleted: ${userId}`);
  }

  async getUserStats(userId: string): Promise<UserStats> {
    this.logger.debug(`Computing stats for user: ${userId}`);
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
    this.logger.debug(
      `Fetching enrollments for user: ${userId} - page ${page}, limit ${limit}`,
    );
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
    this.logger.debug(
      `Fetching submissions for user: ${userId} - page ${page}, limit ${limit}, status ${status}`,
    );
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

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email, deletedAt: null },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username, deletedAt: null },
    });
  }
}
