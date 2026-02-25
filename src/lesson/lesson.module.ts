import { Module } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { LessonController } from './lesson.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CourseModule } from '../course/course.module';

@Module({
  imports: [PrismaModule, CourseModule],
  controllers: [LessonController],
  providers: [LessonService],
  exports: [LessonService],
})
export class LessonModule {}
