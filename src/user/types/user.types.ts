import { User } from '@prisma/client';

export interface UserWithStats extends User {
  stats?: {
    coursesEnrolled: number;
    coursesCompleted: number;
    totalSubmissions: number;
    averageExerciseScore: number;
  };
}

export interface PaginatedUsers {
  data: UserWithStats[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UserStats {
  userId: string;
  coursesEnrolled: number;
  coursesCompleted: number;
  totalSubmissions: number;
  successfulSubmissions: number;
  averageExerciseScore: number;
  totalTimeSpent: number;
}
