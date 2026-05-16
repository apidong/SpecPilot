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
  ) {}

  async create(userId: number, dto: CreateAgentDto): Promise<Agent> {
    // Check default agent uniqueness (Req 21.9)
    if (dto.is_default) {
      const existingDefault = await this.agentRepo.findOne({
        where: { user_id: userId, is_default: true },
      });
      if (existingDefault) {
        throw new ConflictException(
          'Default agent already exists. Demote existing default agent first.',
        );
      }
    }

    const agent = this.agentRepo.create({
      user_id: userId,
      ...dto,
    });
    return this.agentRepo.save(agent);
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
    const agent = await this.findOne(agentId, userId);

    // Check default agent uniqueness if setting as default (Req 21.10)
    if (dto.is_default && !agent.is_default) {
      const existingDefault = await this.agentRepo.findOne({
        where: { user_id: userId, is_default: true },
      });
      if (existingDefault && existingDefault.id !== agentId) {
        throw new ConflictException(
          'Default agent already exists. Demote existing default agent first.',
        );
      }
    }

    Object.assign(agent, dto);
    return this.agentRepo.save(agent);
  }

  async remove(agentId: number, userId: number): Promise<void> {
    const agent = await this.findOne(agentId, userId);
    await this.agentRepo.delete(agent.id);
  }
}
