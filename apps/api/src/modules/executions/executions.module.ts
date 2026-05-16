import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutionsController } from './executions.controller.js';
import { ExecutionsService } from './executions.service.js';
import { Execution } from '../../database/entities/execution.entity.js';
import { ExecutionLog } from '../../database/entities/execution-log.entity.js';
import { FileChange } from '../../database/entities/file-change.entity.js';
import { VerificationResult } from '../../database/entities/verification-result.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Execution, ExecutionLog, FileChange, VerificationResult]),
  ],
  controllers: [ExecutionsController],
  providers: [ExecutionsService],
  exports: [ExecutionsService],
})
export class ExecutionsModule {}
