import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * LoginThrottleGuard: rate-limits login attempts by email.
 * 5 failures/min → block for 5 min (Req 2.3).
 *
 * Applied ONLY to AuthController.login() via @UseGuards(LoginThrottleGuard).
 */
@Injectable()
export class LoginThrottleGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // Track by email (not IP) so lockout is per-account
    const email = (req.body as { email?: string })?.email ?? req.ip ?? 'unknown';
    return `login:${email}`;
  }

  protected async throwThrottlingException(
    _context: ExecutionContext,
    _throttlerLimitDetail: unknown,
  ): Promise<void> {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message:
          'Too many login attempts. Please wait 5 minutes before trying again.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
