import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Agent } from '../../database/entities/agent.entity.js';
import { CreateAgentDto, UpdateAgentDto } from './dto/agent.dto.js';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: number, dto: CreateAgentDto): Promise<Agent> {
    if (!dto.is_default) {
      const agent = this.agentRepo.create({ user_id: userId, ...dto });
      return this.agentRepo.save(agent);
    }

    // Use transaction with lock to prevent concurrent default agents (Req 21.9)
    return this.dataSource.transaction(async (manager) => {
      // Lock all user agents to serialize concurrent default-setting
      await manager.query(
        'SELECT id FROM agents WHERE user_id = ? FOR UPDATE',
        [userId],
      );
      const existingDefault = await manager.findOne(Agent, {
        where: { user_id: userId, is_default: true },
      });
      if (existingDefault) {
        throw new ConflictException(
          'Default agent already exists. Demote existing default agent first.',
        );
      }
      const agent = manager.create(Agent, { user_id: userId, ...dto });
      return manager.save(agent);
    });
  }

  async findAll(userId: number): Promise<Agent[]> {
    return this.agentRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(agentId: number, userId: number): Promise<Agent> {
    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    if (agent.user_id !== userId) throw new NotFoundException('Agent not found');
    return agent;
  }

  async update(agentId: number, userId: number, dto: UpdateAgentDto): Promise<Agent> {
    if (!dto.is_default) {
      const agent = await this.findOne(agentId, userId);
      Object.assign(agent, dto);
      return this.agentRepo.save(agent);
    }

    // Use transaction with lock when setting as default (Req 21.10)
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        'SELECT id FROM agents WHERE user_id = ? FOR UPDATE',
        [userId],
      );
      const agent = await manager.findOne(Agent, { where: { id: agentId } });
      if (!agent || agent.user_id !== userId) throw new NotFoundException('Agent not found');

      if (!agent.is_default) {
        const existingDefault = await manager.findOne(Agent, {
          where: { user_id: userId, is_default: true },
        });
        if (existingDefault && existingDefault.id !== agentId) {
          throw new ConflictException(
            'Default agent already exists. Demote existing default agent first.',
          );
        }
      }
      Object.assign(agent, dto);
      return manager.save(agent);
    });
  }

  async remove(agentId: number, userId: number): Promise<void> {
    const agent = await this.findOne(agentId, userId);
    await this.agentRepo.delete(agent.id);
  }
}
