import { CodeExecutionService } from './code-execution.service';
import { Module } from '@nestjs/common';

@Module({
  providers: [CodeExecutionService],
  exports: [CodeExecutionService],
})
export class CodeExecutionModule {}
