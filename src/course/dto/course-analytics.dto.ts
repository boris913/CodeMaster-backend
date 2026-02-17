import { ApiProperty } from '@nestjs/swagger';

export class CourseAnalyticsDto {
  @ApiProperty({ description: 'Total number of enrollments' })
  totalEnrollments: number;

  @ApiProperty({ description: 'Number of completed enrollments' })
  completedEnrollments: number;

  @ApiProperty({ description: 'Completion rate in percentage' })
  completionRate: number;

  @ApiProperty({ description: 'Average rating' })
  averageRating: number;

  @ApiProperty({ description: 'Total time spent by all students in minutes' })
  totalTimeSpent: number;

  @ApiProperty({ description: 'Enrollment trend over time' })
  enrollmentTrend: Array<{ period: string; count: number }>;

  @ApiProperty({ description: 'Module completion rates' })
  moduleCompletion: Array<{
    moduleId: string;
    title: string;
    completionRate: number;
  }>;
}
