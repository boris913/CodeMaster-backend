import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { CourseModule } from './course/course.module';
import { LessonModule } from './lesson/lesson.module';
import { ModuleModule } from './module/module.module';
import { ProgressModule } from './progress/progress.module';
import { ExercisesModule } from './exercise/exercise.module';
import { CommentModule } from './comment/comment.module';
import { NotificationModule } from './notification/notification.module';
import { UserModule } from './user/user.module';
import { AdminModule } from './admin/admin.module';
import { FavoriteModule } from './favorite/favorite.module';
import { CodeExecutionModule } from './code-execution/code-execution.module';
import jwtConfig from './config/jwt.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [jwtConfig],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 5, // 5 tentatives max
      },
    ]),
    PrismaModule,
    AuthModule,
    CourseModule,
    LessonModule,
    ModuleModule,
    ProgressModule,
    ExercisesModule,
    CommentModule,
    NotificationModule,
    UserModule,
    AdminModule,
    FavoriteModule,
    CodeExecutionModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
