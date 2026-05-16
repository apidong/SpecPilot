import { Test, TestingModule } from '@nestjs/testing';
import { AgentsService } from './agents.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Agent } from '../../database/entities/agent.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockAgent = {
  id: 1,
  user_id: 10,
  name: 'My Agent',
  type: 'openai',
  provider: 'openai_compatible',
  model: 'gpt-4o',
  config_json: { api_key: 'sk-test' },
  is_default: false,
  created_at: new Date(),
};

const mockAgentRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

describe('AgentsService', () => {
  let service: AgentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentsService,
        { provide: getRepositoryToken(Agent), useValue: mockAgentRepo },
      ],
    }).compile();

    service = module.get<AgentsService>(AgentsService);
    jest.clearAllMocks();
  });

  it('should create an agent (P17: default agent uniqueness)', async () => {
    mockAgentRepo.findOne.mockResolvedValue(null);
    mockAgentRepo.create.mockReturnValue(mockAgent);
    mockAgentRepo.save.mockResolvedValue(mockAgent);

    const result = await service.create(10, {
      name: 'My Agent',
      type: 'openai',
      provider: 'openai_compatible',
      model: 'gpt-4o',
      config_json: { api_key: 'sk-test' },
      is_default: false,
    });

    expect(result).toHaveProperty('id');
  });

  it('should throw ConflictException when setting second default (P17)', async () => {
    mockAgentRepo.findOne.mockResolvedValue({ id: 2, is_default: true });

    await expect(
      service.create(10, {
        name: 'Second Agent',
        type: 'openai',
        provider: 'openai_compatible',
        model: 'gpt-4o',
        config_json: {},
        is_default: true,
      })
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException for agent not owned by user', async () => {
    mockAgentRepo.findOne.mockResolvedValue({ ...mockAgent, user_id: 99 });

    await expect(service.findOne(1, 10)).rejects.toThrow(NotFoundException);
  });

  it('should list all agents for user', async () => {
    mockAgentRepo.find.mockResolvedValue([mockAgent]);
    const result = await service.findAll(10);
    expect(result).toHaveLength(1);
  });
});
