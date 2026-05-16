import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ExecutionsService } from './executions.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../../database/entities/user.entity.js';

@ApiTags('Executions')
@ApiBearerAuth()
@Controller('api/executions')
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    await this.executionsService.verifyOwnership(id, user.id);
    return this.executionsService.findOne(id);
  }

  @Get(':id/logs')
  async getLogs(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 100,
  ) {
    await this.executionsService.verifyOwnership(id, user.id);
    return this.executionsService.getLogs(id, page, limit);
  }

  @Get(':id/changes')
  async getChanges(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
  ) {
    await this.executionsService.verifyOwnership(id, user.id);
    return this.executionsService.getChanges(id, page, limit);
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  async stop(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    await this.executionsService.verifyOwnership(id, user.id);
    return this.executionsService.stop(id);
  }
}