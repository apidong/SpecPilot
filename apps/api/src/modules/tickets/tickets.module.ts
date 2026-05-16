import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';
import { ConcurrentExecutionGuardService } from './concurrent-execution-guard.service.js';
import { CommitService } from './commit.service.js';
import { Ticket } from '../../database/entities/ticket.entity.js';
import { Spec } from '../../database/entities/spec.entity.js';
import { Execution } from '../../database/entities/execution.entity.js';
import { FileChange } from '../../database/entities/file-change.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, Spec, Execution, FileChange]),
    BullModule.registerQueue({ name: 'execution' }),
  ],
  controllers: [TicketsController],
  providers: [TicketsService, ConcurrentExecutionGuardService, CommitService],
  exports: [TicketsService],
})
export class TicketsModule {}
