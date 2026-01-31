// src/notifications/listeners/notification.listener.ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../notification.service';

// Interfaces for event payload typing
interface CommentCreatedPayload {
  comment: {
    id: string;
  };
  lesson: {
    id: string;
    title: string;
    module: {
      course: {
        instructorId: string;
      };
    };
  };
  user: {
    id: string;
    username: string;
  };
}

interface ExerciseSubmittedPayload {
  exercise: {
    id: string;
    title: string;
    lesson: {
      module: {
        course: {
          instructorId: string;
        };
      };
    };
  };
  user: {
    id: string;
    username: string;
  };
}

interface CourseEnrolledPayload {
  course: {
    id: string;
    title: string;
    instructorId: string;
  };
  user: {
    id: string;
    username: string;
  };
}

interface LessonCompletedPayload {
  lesson: {
    id: string;
    title: string;
    module: {
      course: {
        id: string;
        instructorId: string;
      };
    };
  };
  user: {
    id: string;
    username: string;
  };
}

@Injectable()
export class NotificationListener {
  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent('comment.created')
  async handleCommentCreatedEvent(
    payload: CommentCreatedPayload,
  ): Promise<void> {
    // Create a notification when a comment is posted
    const { comment, lesson, user } = payload;

    // Notify the course instructor if they are not the one who commented
    if (lesson.module.course.instructorId !== user.id) {
      await this.notificationService.createCommentNotification(
        lesson.module.course.instructorId,
        comment.id,
        'New Comment',
        `${user.username} commented on your lesson "${lesson.title}"`,
      );
    }
  }

  @OnEvent('exercise.submitted')
  async handleExerciseSubmittedEvent(
    payload: ExerciseSubmittedPayload,
  ): Promise<void> {
    // Create a notification when an exercise is submitted
    const { exercise, user } = payload;

    // Notify the instructor
    await this.notificationService.createExerciseNotification(
      exercise.lesson.module.course.instructorId,
      exercise.id,
      'New Exercise Submission',
      `${user.username} submitted a solution for the exercise "${exercise.title}"`,
    );
  }

  @OnEvent('course.enrolled')
  async handleCourseEnrolledEvent(
    payload: CourseEnrolledPayload,
  ): Promise<void> {
    // Create a notification when a student enrolls in a course
    const { course, user } = payload;

    // Notify the instructor
    await this.notificationService.createCourseNotification(
      course.instructorId,
      course.id,
      'New Student Enrolled',
      `${user.username} enrolled in your course "${course.title}"`,
    );
  }

  @OnEvent('lesson.completed')
  async handleLessonCompletedEvent(
    payload: LessonCompletedPayload,
  ): Promise<void> {
    // Create a notification when a lesson is completed
    const { lesson, user } = payload;

    // Notify the instructor
    await this.notificationService.createCourseNotification(
      lesson.module.course.instructorId,
      lesson.module.course.id,
      'Lesson Completed',
      `${user.username} finished the lesson "${lesson.title}"`,
    );
  }
}
