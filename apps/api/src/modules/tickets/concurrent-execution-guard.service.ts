import {
  Injectable,
  ConflictException,
  ServiceUnavailableException,
  BadGatewayException,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Execution } from '../../database/entities/execution.entity.js';
import { ACTIVE_EXECUTION_STATUSES } from '@specpilot/shared';

@Injectable()
export class ConcurrentExecutionGuardService {
  private readonly logger = new Logger(ConcurrentExecutionGuardService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectQueue('execution')
    private readonly executionQueue: Queue,
  ) {}

  async tryAcquire(
    projectId: number,
    ticketId: number,
    agentId?: number,
  ): Promise<Execution> {
    let savedExecution: Execution | null = null;

    try {
      savedExecution = await this.dataSource.transaction(async (manager) => {
        // Set lock timeout (MariaDB/MySQL) - Req 11.7
        await manager.query(`SET innodb_lock_wait_timeout = 5`);

        // SELECT FOR UPDATE to check active execution (Req 11.1)
        const active = await manager
          .createQueryBuilder(Execution, 'e')
          .setLock('pessimistic_write')
          .where('e.project_id = :projectId', { projectId })
          .andWhere('e.status IN (:...statuses)', {
            statuses: ACTIVE_EXECUTION_STATUSES,
          })
          .getOne();

        if (active) {
          // Req 11.2: 409 Conflict
          throw new ConflictException(
            'There is already an active execution for this project. Stop it first or wait for it to complete.',
          );
        }

        // INSERT new Execution (Req 11.3)
        const execution = manager.create(Execution, {
          ticket_id: ticketId,
          project_id: projectId,
          agent_id: agentId,
          status: 'Queued',
        });
        const saved = await manager.save(execution);

        // Enqueue BullMQ job before COMMIT (Req 11.3, 11.4)
        try {
          await this.executionQueue.add(
            'execute',
            { executionId: saved.id },
            { attempts: 2, backoff: { type: 'exponential', delay: 1000 } },
          );
        } catch (enqueueErr: unknown) {
          // Push failed → transaction rollback (Req 11.4)
          throw new BadGatewayException(
            'Failed to enqueue job; transaction will be rolled back',
          );
        }

        return saved;
      });
    } catch (err: unknown) {
      // Handle lock timeout (Req 11.8)
      if (err instanceof QueryFailedError) {
        const code = (err as QueryFailedError & { errno?: number }).errno;
        if (code === 1205) {
          // MariaDB/MySQL lock wait timeout
          throw new ServiceUnavailableException(
            'Could not acquire execution lock. Try again in a moment.',
          );
        }
      }

      // Re-throw known HTTP exceptions
      if (
        err instanceof ConflictException ||
        err instanceof ServiceUnavailableException ||
        err instanceof BadGatewayException
      ) {
        throw err;
      }

      // If COMMIT fails after enqueue succeeded (Req 11.5), compensate
      if (savedExecution?.id) {
        await this.dataSource
          .getRepository(Execution)
          .update(savedExecution.id, {
            status: 'Failed',
            error_message: 'Enqueue succeeded but transaction commit failed',
          })
          .catch((compensateErr: unknown) => {
            this.logger.error('Compensation failed', compensateErr);
          });
      }

      throw new BadGatewayException('Failed to start execution. Please try again.');
    }

    return savedExecution!;
  }
}
