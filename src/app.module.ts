import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { CourseModule } from './course/course.module';
import { LessonModule } from './lesson/lesson.module';
import { ModuleModule } from './module/module.module';
import { ProgressModule } from './progress/progress.module';
import { ExercisesModule } from './exercise/exercise.module';
import jwtConfig from './config/jwt.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [jwtConfig],
    }),
    PrismaModule,
    AuthModule,
    CourseModule,
    LessonModule,
    ModuleModule,
    ProgressModule,
    ExercisesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
