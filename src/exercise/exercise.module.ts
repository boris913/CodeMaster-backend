// src/exercises/exercise.module.ts
import { Module } from '@nestjs/common';
import { ExerciseController } from './exercise.controller';
import { ExerciseService } from './exercise.service';
import { CodeExecutionService } from '../code-execution/code-execution.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ExerciseController],
  providers: [ExerciseService, CodeExecutionService],
  exports: [ExerciseService],
})
export class ExercisesModule {}
