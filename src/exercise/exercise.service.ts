// src/exercises/exercise.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeExecutionService } from '../code-execution/code-execution.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { SubmitExerciseDto } from './dto/submit-exercise.dto';
import {
  Exercise,
  Submission,
  SubmissionStatus,
  Language,
  Difficulty,
  Role,
} from '@prisma/client';

interface TestResult {
  name?: string;
  passed?: boolean;
  error?: string;
}

interface ExecutionResult {
  output: string;
  error: string;
  executionTime: number;
  memoryUsed: number;
  passed: boolean;
  testResults?: TestResult[];
}

@Injectable()
export class ExerciseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeExecutionService: CodeExecutionService,
  ) {}

  async create(
    createExerciseDto: CreateExerciseDto,
    userId: string,
  ): Promise<Exercise> {
    // Verify that user is an instructor or admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== Role.INSTRUCTOR && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only instructors and administrators can create exercises',
      );
    }

    // Verify that lesson exists
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: createExerciseDto.lessonId },
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

    // Verify that user is the course instructor
    if (
      lesson.module.course.instructorId !== userId &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'You can only create exercises for your own courses',
      );
    }

    // Check if an exercise already exists for this lesson
    const existingExercise = await this.prisma.exercise.findUnique({
      where: { lessonId: createExerciseDto.lessonId },
    });

    if (existingExercise) {
      throw new BadRequestException(
        'This lesson already has an associated exercise',
      );
    }

    // Create exercise
    return this.prisma.exercise.create({
      data: {
        title: createExerciseDto.title,
        instructions: createExerciseDto.instructions,
        starterCode: createExerciseDto.starterCode,
        solution: createExerciseDto.solution,
        tests: createExerciseDto.tests,
        language: createExerciseDto.language,
        difficulty: createExerciseDto.difficulty || Difficulty.BEGINNER,
        hints: createExerciseDto.hints || [],
        timeLimit: createExerciseDto.timeLimit || 30,
        memoryLimit: createExerciseDto.memoryLimit || 128,
        points: createExerciseDto.points || 10,
        lessonId: createExerciseDto.lessonId,
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
    });
  }

  async findOne(id: string, userId: string): Promise<Exercise> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
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
        submissions: {
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            passedTests: true,
            totalTests: true,
            createdAt: true,
          },
        },
      },
    });

    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    // Check permissions
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isInstructor = exercise.lesson.module.course.instructorId === userId;
    const isAdmin = user.role === Role.ADMIN;
    const isEnrolled = await this.isUserEnrolled(
      userId,
      exercise.lesson.module.course.id,
    );

    if (!isInstructor && !isAdmin && !isEnrolled) {
      throw new ForbiddenException(
        'You must be enrolled in the course to access this exercise',
      );
    }

    // Hide solution and some tests for students
    if (!isInstructor && !isAdmin) {
      delete exercise.solution;
      // Do not return full tests for students
      exercise.tests = '// Tests hidden for students';
    }

    return exercise;
  }

  async submitSolution(
    exerciseId: string,
    userId: string,
    submitDto: SubmitExerciseDto,
  ): Promise<Submission> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
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

    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    // Check if user is enrolled in the course
    const isEnrolled = await this.isUserEnrolled(
      userId,
      exercise.lesson.module.course.id,
    );
    if (!isEnrolled) {
      throw new ForbiddenException(
        'You must be enrolled in the course to submit a solution',
      );
    }

    // Create submission with PENDING status
    const submission = await this.prisma.submission.create({
      data: {
        code: submitDto.code,
        language: submitDto.language,
        status: SubmissionStatus.PENDING,
        userId,
        exerciseId,
      },
    });

    try {
      // Execute code in background
      void this.processSubmission(submission, exercise, submitDto.customInput);
    } catch (error: unknown) {
      // Update status on error
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: SubmissionStatus.ERROR,
          result: { error: errorMessage },
        },
      });
    }

    return submission;
  }

  private async processSubmission(
    submission: Submission,
    exercise: Exercise & { lesson: { id: string } },
    customInput?: string,
  ): Promise<void> {
    try {
      // Update status to RUNNING
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: { status: SubmissionStatus.RUNNING },
      });

      // Prepare tests
      let testSuite = exercise.tests;
      if (customInput) {
        // Add custom test
        testSuite = this.addCustomTest(
          testSuite,
          customInput,
          exercise.language,
        );
      }

      // Execute code
      const result: ExecutionResult =
        await this.codeExecutionService.executeCode(
          submission.code,
          exercise.language,
          testSuite,
          exercise.timeLimit,
          exercise.memoryLimit,
        );

      // Determine final status
      const status: SubmissionStatus = result.passed
        ? SubmissionStatus.SUCCESS
        : SubmissionStatus.FAILED;

      // Convert ExecutionResult to serializable JSON format
      const resultJson = {
        output: result.output,
        error: result.error,
        executionTime: result.executionTime,
        memoryUsed: result.memoryUsed,
        passed: result.passed,
        testResults: (result.testResults || []).map((r) => ({
          name: r.name,
          passed: r.passed,
          error: r.error,
        })),
      };

      // Update submission
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          status,
          result: resultJson,
          executionTime: result.executionTime,
          memoryUsed: result.memoryUsed,
          passedTests: result.testResults?.filter((r) => r.passed).length || 0,
          totalTests: result.testResults?.length || 0,
        },
      });

      // If it's the first successful submission, mark lesson as completed
      if (status === SubmissionStatus.SUCCESS) {
        await this.markLessonAsCompleted(submission.userId, exercise.lesson.id);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: SubmissionStatus.ERROR,
          result: { error: errorMessage },
        },
      });
    }
  }

  private addCustomTest(
    testSuite: string,
    customInput: string,
    language: Language,
  ): string {
    switch (language) {
      case Language.JAVASCRIPT:
      case Language.TYPESCRIPT:
        return `
              ${testSuite}
              
              // Custom test
              try {
                const userResult = eval(\`${customInput}\`);
                console.log('Custom test result:', userResult);
              } catch (error) {
                console.error('Custom test failed:', error.message);
              }
            `;
      case Language.PYTHON:
        return `
              ${testSuite}
              
              # Custom test
              try:
                user_result = eval("""${customInput}""")
                print(f'Custom test result: {user_result}')
              except Exception as e:
                print(f'Custom test failed: {str(e)}')
            `;
      default:
        return testSuite;
    }
  }

  private async markLessonAsCompleted(
    userId: string,
    lessonId: string,
  ): Promise<void> {
    // Check if progress already exists
    const existingProgress = await this.prisma.progress.findUnique({
      where: {
        userId_lessonId: { userId, lessonId },
      },
    });

    if (!existingProgress || !existingProgress.completed) {
      await this.prisma.progress.upsert({
        where: {
          userId_lessonId: { userId, lessonId },
        },
        update: {
          completed: true,
          completedAt: new Date(),
        },
        create: {
          userId,
          lessonId,
          completed: true,
          completedAt: new Date(),
        },
      });
    }
  }

  async getUserSubmissions(
    exerciseId: string,
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: Submission[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const [submissions, total] = await Promise.all([
      this.prisma.submission.findMany({
        where: { exerciseId, userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.submission.count({
        where: { exerciseId, userId },
      }),
    ]);

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

  async getLeaderboard(
    exerciseId: string,
    limit: number = 20,
  ): Promise<unknown[]> {
    // Get best submissions per user
    const bestSubmissions = await this.prisma.$queryRaw`
          SELECT DISTINCT ON (s."userId") 
            s.*,
            u.username,
            u.avatar,
            ROW_NUMBER() OVER (ORDER BY s."passedTests" DESC, s."executionTime" ASC, s."createdAt" ASC) as rank
          FROM submissions s
          JOIN users u ON u.id = s."userId"
          WHERE s."exerciseId" = ${exerciseId}
            AND s."status" = 'SUCCESS'
          ORDER BY s."userId", s."passedTests" DESC, s."executionTime" ASC
          LIMIT ${limit}
        `;

    return bestSubmissions as unknown[];
  }

  async testExerciseCode(
    exerciseId: string,
    userId: string,
    code: string,
    language: Language,
  ): Promise<ExecutionResult> {
    // Get exercise
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
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

    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    // Check permissions
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isInstructor = exercise.lesson.module.course.instructorId === userId;
    const isAdmin = user.role === Role.ADMIN;

    if (!isInstructor && !isAdmin) {
      throw new ForbiddenException(
        'Only instructors or administrators can test an exercise',
      );
    }

    // Verify language
    if (language !== exercise.language) {
      throw new BadRequestException(
        `Invalid language. Expected language: ${exercise.language}`,
      );
    }

    // Execute code via CodeExecutionService
    return this.codeExecutionService.executeCode(
      code,
      language,
      exercise.tests,
      exercise.timeLimit,
      exercise.memoryLimit,
    );
  }

  async update(
    id: string,
    updateExerciseDto: UpdateExerciseDto,
    userId: string,
  ): Promise<Exercise> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
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

    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    // Check permissions
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (
      exercise.lesson.module.course.instructorId !== userId &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('You can only modify your own exercises');
    }

    return this.prisma.exercise.update({
      where: { id },
      data: updateExerciseDto,
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            module: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
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

    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    // Check permissions
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (
      exercise.lesson.module.course.instructorId !== userId &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('You can only delete your own exercises');
    }

    await this.prisma.exercise.delete({
      where: { id },
    });
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
}
