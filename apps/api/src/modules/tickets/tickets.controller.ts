import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TicketsService } from './tickets.service.js';
import { CreateTicketDto, UpdateTicketDto, AskAgentFixDto } from './dto/ticket.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../../database/entities/user.entity.js';

@ApiTags('Tickets')
@ApiBearerAuth()
@Controller('api')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post('specs/:specId/tickets')
  create(
    @Param('specId', ParseIntPipe) specId: number,
    @CurrentUser() user: User,
    @Body() dto: CreateTicketDto,
  ) {
    return this.ticketsService.create(specId, user.id, dto);
  }

  @Get('projects/:projectId/tickets')
  findAll(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ) {
    return this.ticketsService.findAll(projectId, user.id);
  }

  @Get('tickets/:id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.ticketsService.findOne(id, user.id);
  }

  @Put('tickets/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.ticketsService.update(id, user.id, dto);
  }

  @Post('tickets/:id/run')
  @HttpCode(HttpStatus.ACCEPTED)
  run(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.ticketsService.run(id, user.id);
  }

  @Post('tickets/:id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.ticketsService.approve(id, user.id);
  }

  @Post('tickets/:id/reject')
  reject(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.ticketsService.reject(id, user.id);
  }

  @Post('tickets/:id/commit')
  commit(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.ticketsService.commit(id, user.id);
  }

  @Post('tickets/:id/ask-agent-fix')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ errorHttpStatusCode: 400 }))
  askAgentFix(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: AskAgentFixDto,
  ) {
    return this.ticketsService.askAgentFix(id, user.id, dto);
  }
}
