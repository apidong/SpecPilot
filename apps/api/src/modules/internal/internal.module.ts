import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller.js';
import { ExecutionsModule } from '../executions/executions.module.js';

@Module({
  imports: [ExecutionsModule],
  controllers: [InternalController],
})
export class InternalModule {}
