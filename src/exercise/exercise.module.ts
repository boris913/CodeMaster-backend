// src/exercises/exercise.module.ts
import { Module } from '@nestjs/common';
import { ExerciseController } from './exercise.controller';
import { ExerciseService } from './exercise.service';
import { CodeExecutionModule } from '../code-execution/code-execution.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, CodeExecutionModule],
  controllers: [ExerciseController],
  providers: [ExerciseService],
  exports: [ExerciseService],
})
export class ExercisesModule {}
