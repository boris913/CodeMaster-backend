// src/comments/comment.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { Role } from '@prisma/client';

// Interface for typing comments with relations
interface CommentWithRelations {
  id: string;
  content: string;
  userId: string;
  lessonId: string;
  parentId: string | null;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    username: string;
    avatar: string | null;
    role: Role;
  };
  replies?: CommentWithRelations[];
}

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createCommentDto: CreateCommentDto,
    userId: string,
  ): Promise<CommentResponseDto> {
    // Check if the lesson exists
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: createCommentDto.lessonId },
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

    // Check if the user is enrolled in the course
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const isInstructor = lesson.module.course.instructorId === userId;
    const isAdmin = user.role === Role.ADMIN;
    const isEnrolled = await this.isUserEnrolled(
      userId,
      lesson.module.course.id,
    );

    if (!isInstructor && !isAdmin && !isEnrolled) {
      throw new ForbiddenException(
        'You must be enrolled in the course to post a comment',
      );
    }

    // Validate parent comment if provided
    if (createCommentDto.parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: createCommentDto.parentId },
        include: {
          lesson: true,
        },
      });

      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }

      if (parentComment.lessonId !== createCommentDto.lessonId) {
        throw new BadRequestException(
          'The parent comment does not belong to the same lesson',
        );
      }
    }

    // Create the comment
    const comment = await this.prisma.comment.create({
      data: {
        content: createCommentDto.content,
        userId,
        lessonId: createCommentDto.lessonId,
        parentId: createCommentDto.parentId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            role: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return this.mapToCommentResponseDto(comment as CommentWithRelations);
  }

  async findOne(id: string): Promise<CommentResponseDto> {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            role: true,
          },
        },
        lesson: {
          select: {
            id: true,
            title: true,
            module: {
              select: {
                id: true,
                title: true,
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
        replies: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
                role: true,
              },
            },
            replies: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    avatar: true,
                    role: true,
                  },
                },
              },
              take: 5,
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    return this.mapToCommentResponseDto(comment as CommentWithRelations);
  }

  async findByLesson(
    lessonId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: CommentResponseDto[]; meta: any }> {
    // Check if the lesson exists
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: {
          lessonId,
          parentId: null,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
              role: true,
            },
          },
          replies: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatar: true,
                  role: true,
                },
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.comment.count({
        where: {
          lessonId,
          parentId: null,
        },
      }),
    ]);

    const commentDtos = comments.map((comment) =>
      this.mapToCommentResponseDto(comment as CommentWithRelations),
    );

    return {
      data: commentDtos,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(
    id: string,
    updateCommentDto: UpdateCommentDto,
    userId: string,
  ): Promise<CommentResponseDto> {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        user: true,
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
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Permissions check
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const isOwner = comment.userId === userId;
    const isInstructor = comment.lesson.module.course.instructorId === userId;
    const isAdmin = user.role === Role.ADMIN;

    if (!isOwner && !isInstructor && !isAdmin) {
      throw new ForbiddenException(
        'You are not authorized to modify this comment',
      );
    }

    const updatedComment = await this.prisma.comment.update({
      where: { id },
      data: {
        content: updateCommentDto.content,
        isEdited: true,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            role: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return this.mapToCommentResponseDto(updatedComment as CommentWithRelations);
  }

  async remove(id: string, userId: string): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        user: true,
        lesson: {
          include: {
            module: {
              include: {
                course: true,
              },
            },
          },
        },
        replies: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Permissions check
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const isOwner = comment.userId === userId;
    const isInstructor = comment.lesson.module.course.instructorId === userId;
    const isAdmin = user.role === Role.ADMIN;

    if (!isOwner && !isInstructor && !isAdmin) {
      throw new ForbiddenException(
        'You are not authorized to delete this comment',
      );
    }

    // If the comment has replies, delete them as well
    if (comment.replies.length > 0) {
      await this.prisma.comment.deleteMany({
        where: { parentId: id },
      });
    }

    await this.prisma.comment.delete({
      where: { id },
    });
  }

  async reply(
    parentId: string,
    createCommentDto: CreateCommentDto,
    userId: string,
  ): Promise<CommentResponseDto> {
    // Check if the parent comment exists
    const parentComment = await this.prisma.comment.findUnique({
      where: { id: parentId },
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
    });

    if (!parentComment) {
      throw new NotFoundException('Parent comment not found');
    }

    // Check if user is enrolled
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const isInstructor =
      parentComment.lesson.module.course.instructorId === userId;
    const isAdmin = user.role === Role.ADMIN;
    const isEnrolled = await this.isUserEnrolled(
      userId,
      parentComment.lesson.module.course.id,
    );

    if (!isInstructor && !isAdmin && !isEnrolled) {
      throw new ForbiddenException(
        'You must be enrolled in the course to reply to a comment',
      );
    }

    // Create the reply
    const comment = await this.prisma.comment.create({
      data: {
        content: createCommentDto.content,
        userId,
        lessonId: parentComment.lessonId,
        parentId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            role: true,
          },
        },
        parent: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    // Add empty replies array
    const commentWithReplies = {
      ...comment,
      replies: [],
    };

    return this.mapToCommentResponseDto(
      commentWithReplies as CommentWithRelations,
    );
  }

  private async isUserEnrolled(
    userId: string,
    courseId: string,
  ): Promise<boolean> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId },
      },
    });
    return !!enrollment;
  }

  private mapToCommentResponseDto(
    comment: CommentWithRelations,
  ): CommentResponseDto {
    const dto = new CommentResponseDto();

    // Base property assignment
    dto.id = comment.id;
    dto.content = comment.content;
    dto.userId = comment.userId;
    dto.lessonId = comment.lessonId;
    dto.parentId = comment.parentId;
    dto.isEdited = comment.isEdited;
    dto.createdAt = comment.createdAt;
    dto.updatedAt = comment.updatedAt;

    // Map user info
    if (comment.user) {
      dto.user = {
        id: comment.user.id,
        username: comment.user.username,
        avatar: comment.user.avatar || undefined,
        role: comment.user.role,
      };
    } else {
      // Default user if missing
      dto.user = {
        id: 'unknown',
        username: 'Unknown User',
        role: Role.STUDENT,
      };
    }

    // Recursively map replies
    if (comment.replies && Array.isArray(comment.replies)) {
      dto.replies = comment.replies.map((reply: CommentWithRelations) =>
        this.mapToCommentResponseDto(reply),
      );
    } else {
      dto.replies = [];
    }

    return dto;
  }
}
