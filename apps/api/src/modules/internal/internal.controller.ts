import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { WorkerSecretGuard } from '../../common/guards/worker-secret.guard.js';
import { ExecutionsService } from '../executions/executions.service.js';
import {
  UpdateExecutionStatusDto,
  BatchLogsDto,
  AddFileChangeDto,
  AddVerificationResultDto,
} from './dto/internal.dto.js';

@ApiTags('Internal (Worker)')
@Public()
@UseGuards(WorkerSecretGuard)
@Controller('internal/executions')
export class InternalController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Get(':id')
  getExecution(@Param('id', ParseIntPipe) id: number) {
    return this.executionsService.findOne(id);
  }

  @Put(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExecutionStatusDto,
  ) {
    return this.executionsService.updateStatus(id, dto.status as any, dto.error_message);
  }

  @Post(':id/logs')
  addLogs(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BatchLogsDto,
  ) {
    return this.executionsService.addLogs(id, dto.logs);
  }

  @Post(':id/changes')
  addChange(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddFileChangeDto,
  ) {
    return this.executionsService.addChange(id, dto);
  }

  @Post(':id/verification')
  addVerification(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddVerificationResultDto,
  ) {
    return this.executionsService.addVerificationResult(id, dto);
  }
}
