import { Test, TestingModule } from '@nestjs/testing';
import { ConcurrentExecutionGuardService } from './concurrent-execution-guard.service';
import { DataSource, QueryFailedError } from 'typeorm';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';

const mockQueryBuilder = {
  setLock: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getOne: jest.fn(),
};

const mockEntityManager = {
  query: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  create: jest.fn(),
  save: jest.fn(),
};

const mockDataSource = {
  transaction: jest.fn(),
  getRepository: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
};

describe('ConcurrentExecutionGuardService (P5)', () => {
  let service: ConcurrentExecutionGuardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConcurrentExecutionGuardService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: getQueueToken('execution'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<ConcurrentExecutionGuardService>(ConcurrentExecutionGuardService);
    jest.clearAllMocks();
  });

  it('should throw ConflictException if active execution exists (P5)', async () => {
    mockDataSource.transaction.mockImplementation(async (cb: Function) => {
      const manager = {
        ...mockEntityManager,
        createQueryBuilder: jest.fn().mockReturnValue({
          ...mockQueryBuilder,
          getOne: jest.fn().mockResolvedValue({ id: 99, status: 'Running Agent' }),
        }),
        query: jest.fn(),
      };
      return cb(manager);
    });

    await expect(service.tryAcquire(1, 1, undefined)).rejects.toThrow(ConflictException);
  });

  it('should throw ServiceUnavailableException on lock timeout (P5)', async () => {
    const lockError = new QueryFailedError('SELECT FOR UPDATE', [], { errno: 1205 } as any);
    mockDataSource.transaction.mockRejectedValue(lockError);

    await expect(service.tryAcquire(1, 1, undefined)).rejects.toThrow(ServiceUnavailableException);
  });

  it('should enqueue job and return execution on success (P5)', async () => {
    const savedExecution = { id: 42, status: 'Queued', ticket_id: 1, project_id: 1 };
    mockDataSource.transaction.mockImplementation(async (cb: Function) => {
      const manager = {
        ...mockEntityManager,
        query: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue({
          ...mockQueryBuilder,
          getOne: jest.fn().mockResolvedValue(null),
        }),
        create: jest.fn().mockReturnValue(savedExecution),
        save: jest.fn().mockResolvedValue(savedExecution),
      };
      mockQueue.add.mockResolvedValue({});
      return cb(manager);
    });

    const result = await service.tryAcquire(1, 1, undefined);
    expect(result).toHaveProperty('id', 42);
    expect(mockQueue.add).toHaveBeenCalledWith(
      'execute',
      { executionId: 42 },
      expect.any(Object),
    );
  });
});
