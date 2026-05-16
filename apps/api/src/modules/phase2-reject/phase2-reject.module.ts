import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Phase2RejectController } from './phase2-reject.controller.js';
import { Phase2RejectService } from './phase2-reject.service.js';
import { AuditLog } from '../../database/entities/audit-log.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [Phase2RejectController],
  providers: [Phase2RejectService],
})
export class Phase2RejectModule {}
