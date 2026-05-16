import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { databaseConfig } from './database/config/database.config.js';
import { RedisModule } from './common/redis/redis.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RedactSensitiveInterceptor } from './common/interceptors/redact-sensitive.interceptor.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

import { AuthModule } from './modules/auth/auth.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { SpecsModule } from './modules/specs/specs.module.js';
import { AgentsModule } from './modules/agents/agents.module.js';
import { TicketsModule } from './modules/tickets/tickets.module.js';
import { ExecutionsModule } from './modules/executions/executions.module.js';
import { InternalModule } from './modules/internal/internal.module.js';
import { WebsocketModule } from './modules/websocket/websocket.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL', 'info'),
          redact: {
            paths: [
              'req.headers["x-worker-secret"]',
              'req.headers.authorization',
              '*.api_key',
              'env.WORKER_SECRET',
              'env.JWT_SECRET',
            ],
            censor: '[REDACTED]',
          },
          transport:
            config.get<string>('NODE_ENV') !== 'production'
              ? { target: 'pino-pretty' }
              : undefined,
        },
      }),
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: databaseConfig,
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),

    RedisModule,
    AuthModule,
    ProjectsModule,
    SpecsModule,
    AgentsModule,
    TicketsModule,
    ExecutionsModule,
    InternalModule,
    WebsocketModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: RedactSensitiveInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
