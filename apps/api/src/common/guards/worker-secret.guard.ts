import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

@Injectable()
export class WorkerSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const provided = req.header('x-worker-secret') ?? '';
    const expected = this.config.getOrThrow<string>('WORKER_SECRET');

    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');

    let ok = false;
    if (a.length === b.length) {
      ok = timingSafeEqual(a, b);
    }

    if (!ok) {
      throw new UnauthorizedException('Invalid worker secret');
    }

    // Req 13.8: Reject if request also carries Authorization or session cookie
    if (
      req.header('authorization') ||
      req.header('cookie')?.match(/connect\.sid|specpilot_session/)
    ) {
      throw new UnauthorizedException('Worker requests must not carry user credentials');
    }

    return true;
  }
}
