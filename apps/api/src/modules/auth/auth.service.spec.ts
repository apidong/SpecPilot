import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../../database/entities/user.entity';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedPassword'),
  compare: jest.fn().mockImplementation((plain: string, _hash: string) =>
    Promise.resolve(plain === 'password123'),
  ),
}));
import * as bcrypt from 'bcrypt';

const mockUserRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('test-secret'),
};

const mockRedis = {
  sadd: jest.fn(),
  expireat: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.create.mockReturnValue({ id: 1, name: 'Test', email: 'test@test.com' });
      mockUserRepo.save.mockResolvedValue({ id: 1, name: 'Test', email: 'test@test.com' });

      const result = await service.register({ name: 'Test', email: 'test@test.com', password: 'password123' });
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('id');
    });

    it('should throw ConflictException for duplicate email', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 1, email: 'test@test.com' });

      await expect(
        service.register({ name: 'Test', email: 'test@test.com', password: 'password123' })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return access token on valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockUserRepo.findOne.mockResolvedValue({
        id: 1,
        email: 'test@test.com',
        password_hash: hashedPassword,
      });

      const result = await service.login({ email: 'test@test.com', password: 'password123' });
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
    });

    it('should throw UnauthorizedException for invalid credentials (P18)', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'test@test.com', password: 'wrong' })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw same error for wrong password as for missing user (P18 generic failure)', async () => {
      const hashedPassword = await bcrypt.hash('correct', 10);
      mockUserRepo.findOne.mockResolvedValue({
        id: 1,
        email: 'test@test.com',
        password_hash: hashedPassword,
      });

      await expect(
        service.login({ email: 'test@test.com', password: 'wrong' })
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
