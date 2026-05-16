import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpecsController } from './specs.controller.js';
import { SpecsService } from './specs.service.js';
import { ArtifactVersioningService } from './artifact-versioning.service.js';
import { Spec } from '../../database/entities/spec.entity.js';
import { SpecArtifact } from '../../database/entities/spec-artifact.entity.js';
import { Project } from '../../database/entities/project.entity.js';
import { LlmModule } from '../llm/llm.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Spec, SpecArtifact, Project]),
    LlmModule,
  ],
  controllers: [SpecsController],
  providers: [SpecsService, ArtifactVersioningService],
  exports: [SpecsService, ArtifactVersioningService],
})
export class SpecsModule {}
