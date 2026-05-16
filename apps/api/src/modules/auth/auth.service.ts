import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../database/entities/user.entity.js';
import { InjectRedis } from '../../common/redis/redis.module.js';
import { Redis } from 'ioredis';
import { LoginDto, RegisterDto } from './dto/auth.dto.js';
import type { JwtPayload } from './jwt.strategy.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: Partial<User>; token: string }> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      password_hash: passwordHash,
    });

    let saved: User;
    try {
      saved = await this.userRepo.save(user);
    } catch (err) {
      // ER_DUP_ENTRY = 1062 (MySQL) — race condition on unique email index
      if (err instanceof QueryFailedError && (err as QueryFailedError & { errno?: number }).errno === 1062) {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }

    const token = await this.signToken(saved);
    return {
      user: { id: saved.id, name: saved.name, email: saved.email },
      token,
    };
  }

  async login(dto: LoginDto): Promise<{ user: Partial<User>; token: string }> {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
      select: ['id', 'name', 'email', 'password_hash'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = await this.signToken(user);
    return {
      user: { id: user.id, name: user.name, email: user.email },
      token,
    };
  }

  async logout(jti: string, exp: number): Promise<void> {
    // Use per-JTI key so each token gets its own TTL
    // (shared set + expireat would shrink TTL of other tokens)
    const now = Math.floor(Date.now() / 1000);
    const ttl = exp - now;
    if (ttl > 0) {
      await this.redis.set(`auth:denylist:${jti}`, '1', 'EX', ttl);
    }
  }

  private async signToken(user: Pick<User, 'id'>): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      jti: uuidv4(),
    };
    return this.jwtService.signAsync(payload);
  }
}
