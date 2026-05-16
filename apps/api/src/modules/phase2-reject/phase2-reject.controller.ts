import {
  All,
  Controller,
  HttpCode,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Phase2RejectService } from './phase2-reject.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../../database/entities/user.entity.js';

/**
 * Phase2RejectController: catch-all for Phase 2 identifiers.
 * Returns 410 Gone for all matched routes; writes audit log (Req 24.1–24.4).
 * Feature flag PHASE2_REJECT_DISABLED=true disables for integration tests.
 */
@Controller()
export class Phase2RejectController {
  constructor(
    private readonly phase2Service: Phase2RejectService,
    private readonly config: ConfigService,
  ) {}

  // Reject Phase 2 hook/marketplace/spec-graph/billing/workflows endpoints
  @All('api/hooks/*')
  @All('api/marketplace/*')
  @All('api/spec-graph/*')
  @All('api/billing/*')
  @All('api/workflows/*')
  @HttpCode(HttpStatus.GONE)
  async rejectPhase2Routes(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (this.config.get<string>('PHASE2_REJECT_DISABLED') === 'true') {
      return res.status(HttpStatus.NOT_FOUND).json({ statusCode: 404, message: 'Not Found' });
    }

    const userId = (req as Request & { user?: User }).user?.id;
    await this.phase2Service.audit({
      method: req.method,
      path: req.path,
      reason: 'Phase 2 feature not available in MVP',
      userId,
    });

    res.status(HttpStatus.GONE);
    return {
      statusCode: 410,
      error: 'Gone',
      message: 'This feature is not available in the current version (Phase 2).',
    };
  }
}
