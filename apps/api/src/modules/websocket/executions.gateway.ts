import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '../../common/redis/redis.module.js';
import { Redis } from 'ioredis';
import { Execution } from '../../database/entities/execution.entity.js';
import type { JwtPayload } from '../auth/jwt.strategy.js';

@WebSocketGateway({
  namespace: '/executions',
  cors: { origin: process.env['CORS_ORIGIN'] || 'http://localhost:5173' },
})
export class ExecutionsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ExecutionsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(Execution)
    private readonly executionRepo: Repository<Execution>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth as Record<string, string | undefined>)['token'] ??
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) throw new UnauthorizedException('No token');

      const payload = this.jwtService.verify<JwtPayload>(token);

      // Check JWT denylist (logged-out tokens must not connect)
      const isDenied = await this.redis.exists(`auth:denylist:${payload.jti}`);
      if (isDenied) throw new UnauthorizedException('Token has been revoked');

      // Attach userId to socket data for later use in subscribe
      (client.data as Record<string, unknown>)['userId'] = payload.sub;

      this.logger.debug(`Client connected: ${client.id} (user ${payload.sub})`);
    } catch {
      this.logger.warn(`Rejecting unauthenticated socket: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody() data: { executionId: number },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId = (client.data as Record<string, unknown>)['userId'] as number | undefined;
    if (!userId) {
      client.disconnect();
      return;
    }

    // Verify the requesting user owns this execution
    const execution = await this.executionRepo
      .createQueryBuilder('e')
      .innerJoin('projects', 'p', 'p.id = e.project_id')
      .where('e.id = :executionId', { executionId: data.executionId })
      .andWhere('p.user_id = :userId', { userId })
      .getOne();

    if (!execution) {
      this.logger.warn(
        `User ${userId} denied subscribe to execution ${data.executionId}`,
      );
      client.emit('error', { message: 'Execution not found or access denied' });
      return;
    }

    const room = `execution.${data.executionId}`;
    void client.join(room);
    this.logger.debug(`Client ${client.id} subscribed to ${room}`);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { executionId: number },
    @ConnectedSocket() client: Socket,
  ): void {
    const room = `execution.${data.executionId}`;
    void client.leave(room);
  }

  emitExecutionLog(executionId: number, log: Record<string, unknown>): void {
    this.server.to(`execution.${executionId}`).emit('log', log);
  }

  emitExecutionStatus(executionId: number, status: string): void {
    this.server.to(`execution.${executionId}`).emit('status', { status, executionId });
  }
}
