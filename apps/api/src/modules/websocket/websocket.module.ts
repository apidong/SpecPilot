import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutionsGateway } from './executions.gateway.js';
import { Execution } from '../../database/entities/execution.entity.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Execution]),
  ],
  providers: [ExecutionsGateway],
  exports: [ExecutionsGateway],
})
export class WebsocketModule {}
