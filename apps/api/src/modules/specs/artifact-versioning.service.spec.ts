import { Test, TestingModule } from '@nestjs/testing';
import { ArtifactVersioningService } from './artifact-versioning.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SpecArtifact } from '../../database/entities/spec-artifact.entity';
import { DataSource } from 'typeorm';

const mockSpecArtifactRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockEntityManager = {
  createQueryBuilder: jest.fn(),
  query: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  delete: jest.fn(),
  getRepository: jest.fn(),
};

const mockDataSource = {
  transaction: jest.fn(),
  getRepository: jest.fn(),
};

describe('ArtifactVersioningService', () => {
  let service: ArtifactVersioningService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArtifactVersioningService,
        { provide: getRepositoryToken(SpecArtifact), useValue: mockSpecArtifactRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ArtifactVersioningService>(ArtifactVersioningService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('saveVersion should run inside a transaction (P3: append-only)', async () => {
    const artifact = {
      id: 1,
      spec_id: 1,
      type: 'requirements',
      content: 'original',
      version: 1,
      is_current: true,
      generated_by: 'user',
    };

    const newArtifact = { ...artifact, id: 2, version: 2, parent_id: 1 };

    // Mock transaction that calls inner function
    mockDataSource.transaction.mockImplementation(async (cb: Function) => {
      const mockManager = {
        ...mockEntityManager,
        createQueryBuilder: jest.fn().mockReturnValue({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(artifact),
          getMany: jest.fn().mockResolvedValue([artifact]),
          select: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ max: 1 }),
        }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockReturnValue(newArtifact),
        save: jest.fn().mockResolvedValue(newArtifact),
        count: jest.fn().mockResolvedValue(1),
      };
      return cb(mockManager);
    });

    const result = await service.saveVersion(1, 'requirements', 'new content', 'user', 1, 'Updated');
    expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
    expect(result).toHaveProperty('version', 2);
  });
});
