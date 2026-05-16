import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity.js';

/**
 * Phase2RejectService: writes one audit_logs row per rejected Phase 2 request.
 * Req 24.1–24.4: No state mutation; only audit log.
 */
@Injectable()
export class Phase2RejectService {
  private readonly logger = new Logger(Phase2RejectService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async audit(params: {
    method: string;
    path: string;
    reason: string;
    userId?: number;
  }): Promise<void> {
    try {
      const entry = this.auditLogRepo.create({
        action: 'phase2_rejected',
        resource_type: 'phase2',
        user_id: params.userId,
        metadata: {
          method: params.method,
          path: params.path,
          reason: params.reason,
        },
      });
      await this.auditLogRepo.save(entry);
    } catch (err: unknown) {
      // Best-effort; never fail the response due to audit log errors
      this.logger.error('Failed to write Phase 2 audit log', err);
    }
  }
}
