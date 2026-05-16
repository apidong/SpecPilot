import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity.js';
import { InjectRedis } from '../../common/redis/redis.module.js';
import { Redis } from 'ioredis';

export interface JwtPayload {
  sub: number;
  jti: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRedis()
    private readonly redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<User & Pick<JwtPayload, 'jti' | 'exp'>> {
    // Check denylist
    const isDenied = await this.redis.sismember('auth:denylist', payload.jti);
    if (isDenied) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Attach JWT claims so logout can revoke the specific token
    return Object.assign(user, { jti: payload.jti, exp: payload.exp });
  }
}
