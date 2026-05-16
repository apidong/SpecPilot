import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Execution } from '../../database/entities/execution.entity.js';
import { ExecutionLog } from '../../database/entities/execution-log.entity.js';
import { FileChange } from '../../database/entities/file-change.entity.js';
import { VerificationResult } from '../../database/entities/verification-result.entity.js';
import { InjectRedis } from '../../common/redis/redis.module.js';
import { Redis } from 'ioredis';
import type { ExecutionStatus } from '@specpilot/shared';

@Injectable()
export class ExecutionsService {
  constructor(
    @InjectRepository(Execution)
    private readonly executionRepo: Repository<Execution>,
    @InjectRepository(ExecutionLog)
    private readonly logRepo: Repository<ExecutionLog>,
    @InjectRepository(FileChange)
    private readonly fileChangeRepo: Repository<FileChange>,
    @InjectRepository(VerificationResult)
    private readonly verificationRepo: Repository<VerificationResult>,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  async findOne(executionId: number): Promise<Execution> {
    const execution = await this.executionRepo.findOne({
      where: { id: executionId },
      relations: ['ticket', 'agent'],
    });
    if (!execution) throw new NotFoundException('Execution not found');
    return execution;
  }

  async verifyOwnership(executionId: number, userId: number): Promise<Execution> {
    const execution = await this.executionRepo
      .createQueryBuilder('e')
      .innerJoin('projects', 'p', 'p.id = e.project_id')
      .where('e.id = :executionId', { executionId })
      .andWhere('p.user_id = :userId', { userId })
      .getOne();
    if (!execution) throw new ForbiddenException('Execution not found or access denied');
    return execution;
  }

  async findByTicket(ticketId: number): Promise<Execution[]> {
    return this.executionRepo.find({
      where: { ticket_id: ticketId },
      order: { created_at: 'DESC' },
    });
  }

  async updateStatus(executionId: number, status: ExecutionStatus, errorMessage?: string): Promise<Execution> {
    const execution = await this.findOne(executionId);
    execution.status = status;
    if (errorMessage) execution.error_message = errorMessage;
    return this.executionRepo.save(execution);
  }

  async stop(executionId: number): Promise<void> {
    const execution = await this.findOne(executionId);
    // Publish stop signal to Redis (Req 15.1)
    await this.redis.publish(`execution-stop:${executionId}`, JSON.stringify({ executionId }));
    
    // Update status to Cancelled
    execution.status = 'Cancelled';
    await this.executionRepo.save(execution);
  }

  async getLogs(executionId: number, page = 1, limit = 100): Promise<{ data: ExecutionLog[]; total: number }> {
    const [data, total] = await this.logRepo.findAndCount({
      where: { execution_id: executionId },
      order: { created_at: 'ASC' },
      skip: (page - 1) * limit,
      take: Math.min(limit, 500),
    });
    return { data, total };
  }

  async getChanges(executionId: number, page = 1, limit = 50): Promise<{ data: FileChange[]; total: number }> {
    const [data, total] = await this.fileChangeRepo.findAndCount({
      where: { execution_id: executionId },
      order: { created_at: 'ASC' },
      skip: (page - 1) * limit,
      take: Math.min(limit, 100),
    });
    return { data, total };
  }

  async addLogs(executionId: number, logs: Partial<ExecutionLog>[]): Promise<ExecutionLog[]> {
    const entities = logs.map((log) =>
      this.logRepo.create({ ...log, execution_id: executionId }),
    );
    return this.logRepo.save(entities);
  }

  async addChange(executionId: number, change: Partial<FileChange>): Promise<FileChange> {
    const entity = this.fileChangeRepo.create({ ...change, execution_id: executionId });
    return this.fileChangeRepo.save(entity);
  }

  async addVerificationResult(
    executionId: number,
    result: Partial<VerificationResult>,
  ): Promise<VerificationResult> {
    const entity = this.verificationRepo.create({ ...result, execution_id: executionId });
    return this.verificationRepo.save(entity);
  }

  async updateFileChangeReviewStatus(
    fileChangeId: number,
    status: 'pending' | 'reviewed' | 'approved' | 'rejected',
  ): Promise<FileChange> {
    const fc = await this.fileChangeRepo.findOne({ where: { id: fileChangeId } });
    if (!fc) throw new NotFoundException('File change not found');
    fc.review_status = status;
    return this.fileChangeRepo.save(fc);
  }
}
