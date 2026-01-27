import { Progress } from '@prisma/client';

export interface ModuleProgress {
  id: string;
  title: string;
  order: number;
  lessons: Array<{
    id: string;
    title: string;
    slug: string;
    duration: number;
    order: number;
    completed: boolean;
    completedAt: Date | null;
    timeSpent: number;
    lastPosition: number | null;
  }>;
  completedLessons: number;
  totalLessons: number;
  progress: number;
}

export interface CourseProgressResponse {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  overallProgress: number;
  totalTimeSpent: number;
  modules: ModuleProgress[];
  lastActivity: Progress | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  user: {
    id: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
  };
  completedLessons: number;
  totalLessons: number;
  progress: number;
  enrolledAt: Date;
  lastActivity: Date;
}
