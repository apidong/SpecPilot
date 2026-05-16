import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Ticket } from '../../database/entities/ticket.entity.js';
import { Execution } from '../../database/entities/execution.entity.js';
import { Spec } from '../../database/entities/spec.entity.js';
import { CreateTicketDto, UpdateTicketDto, AskAgentFixDto } from './dto/ticket.dto.js';
import { ConcurrentExecutionGuardService } from './concurrent-execution-guard.service.js';
import { CommitService } from './commit.service.js';
import { TICKET_TRANSITIONS } from '@specpilot/shared';
import type { TicketStatus } from '@specpilot/shared';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Spec)
    private readonly specRepo: Repository<Spec>,
    @InjectRepository(Execution)
    private readonly executionRepo: Repository<Execution>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly guardService: ConcurrentExecutionGuardService,
    private readonly commitService: CommitService,
  ) {}

  private async getSpecAndVerify(specId: number, userId: number): Promise<Spec> {
    const spec = await this.specRepo.findOne({
      where: { id: specId },
      relations: ['project'],
    });
    if (!spec) throw new NotFoundException('Spec not found');
    if (spec.project.user_id !== userId) throw new ForbiddenException('Access denied');
    return spec;
  }

  private async getTicketAndVerify(ticketId: number, userId: number): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId },
      relations: ['spec', 'spec.project'],
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.spec.project.user_id !== userId) throw new ForbiddenException('Access denied');
    return ticket;
  }

  async create(specId: number, userId: number, dto: CreateTicketDto): Promise<Ticket> {
    const spec = await this.getSpecAndVerify(specId, userId);
    
    // Propagate default agent (Req 21.11)
    const agentId = dto.agent_id ?? spec.project.default_agent_id;

    const ticket = this.ticketRepo.create({
      spec_id: specId,
      task_id: dto.task_id,
      title: dto.title,
      description: dto.description,
      branch_name: `specpilot/ticket-${Date.now()}`,
      status: 'Backlog',
      agent_id: agentId,
    });
    return this.ticketRepo.save(ticket);
  }

  async findAll(projectId: number, userId: number): Promise<Ticket[]> {
    // Verify project access
    return this.ticketRepo
      .createQueryBuilder('t')
      .innerJoin('t.spec', 's')
      .innerJoin('s.project', 'p')
      .where('p.id = :projectId', { projectId })
      .andWhere('p.user_id = :userId', { userId })
      .orderBy('t.created_at', 'DESC')
      .getMany();
  }

  async findOne(ticketId: number, userId: number): Promise<Ticket> {
    return this.getTicketAndVerify(ticketId, userId);
  }

  async update(ticketId: number, userId: number, dto: UpdateTicketDto): Promise<Ticket> {
    const ticket = await this.getTicketAndVerify(ticketId, userId);
    Object.assign(ticket, dto);
    return this.ticketRepo.save(ticket);
  }

  async transitionStatus(
    ticketId: number,
    userId: number,
    newStatus: TicketStatus,
  ): Promise<Ticket> {
    const ticket = await this.getTicketAndVerify(ticketId, userId);
    const allowedNext = TICKET_TRANSITIONS[ticket.status] ?? [];

    if (!allowedNext.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${ticket.status} to ${newStatus}. Allowed: ${allowedNext.join(', ')}`,
      );
    }

    ticket.status = newStatus;
    return this.ticketRepo.save(ticket);
  }

  async run(ticketId: number, userId: number): Promise<{ execution_id: number }> {
    const ticket = await this.getTicketAndVerify(ticketId, userId);

    if (ticket.status !== 'Ready') {
      throw new BadRequestException(`Ticket must be in Ready status to run. Current: ${ticket.status}`);
    }

    const execution = await this.guardService.tryAcquire(
      ticket.spec.project_id,
      ticketId,
      ticket.agent_id,
    );

    // Update ticket status to Running
    await this.ticketRepo.update(ticketId, { status: 'Running' });

    return { execution_id: execution.id };
  }

  async approve(ticketId: number, userId: number): Promise<Ticket> {
    return this.transitionStatus(ticketId, userId, 'Approved');
  }

  async reject(ticketId: number, userId: number): Promise<Ticket> {
    return this.transitionStatus(ticketId, userId, 'Rejected');
  }

  async commit(ticketId: number, userId: number): Promise<{ sha: string }> {
    const ticket = await this.getTicketAndVerify(ticketId, userId);

    // Req 20.4: 409 for ticket not in Approved
    if (ticket.status !== 'Approved') {
      throw new ConflictException(
        `Ticket must be in Approved status to commit. Current: ${ticket.status}`,
      );
    }

    const result = await this.commitService.commit(ticket);

    // Set status to Merged after successful commit (Req 20.4)
    await this.ticketRepo.update(ticketId, { status: 'Merged' });

    return result;
  }

  async askAgentFix(
    ticketId: number,
    userId: number,
    dto: AskAgentFixDto,
  ): Promise<{ execution_id: number }> {
    const ticket = await this.getTicketAndVerify(ticketId, userId);

    // Req 18.5: ticket must be in Rejected or Waiting Review
    if (!['Rejected', 'Waiting Review'].includes(ticket.status)) {
      throw new ConflictException(
        `Ticket must be in Rejected or Waiting Review to ask agent fix. Current: ${ticket.status}`,
      );
    }

    const projectId = ticket.spec.project_id;
    const execution = await this.guardService.tryAcquire(
      projectId,
      ticketId,
      ticket.agent_id,
      dto.comments,
    );

    await this.ticketRepo.update(ticketId, { status: 'Running' });

    return { execution_id: execution.id };
  }
}
