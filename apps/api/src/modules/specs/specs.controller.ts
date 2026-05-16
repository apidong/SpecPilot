import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  ParseEnumPipe,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SpecsService } from './specs.service.js';
import { ArtifactVersioningService } from './artifact-versioning.service.js';
import {
  CreateSpecDto,
  UpdateSpecDto,
  UpdateArtifactDto,
  GenerateRequirementsDto,
} from './dto/spec.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { User } from '../../database/entities/user.entity.js';
import type { ArtifactType } from '@specpilot/shared';

// Runtime enum object for ParseEnumPipe (ArtifactType is a TS union, not an enum)
const ArtifactTypeEnum = {
  requirements: 'requirements',
  design: 'design',
  tasks: 'tasks',
} as const;

@ApiTags('Specs')
@ApiBearerAuth()
@Controller('api')
export class SpecsController {
  constructor(
    private readonly specsService: SpecsService,
    private readonly versioningService: ArtifactVersioningService,
  ) {}

  @Post('projects/:projectId/specs')
  createSpec(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
    @Body() dto: CreateSpecDto,
  ) {
    return this.specsService.create(projectId, user.id, dto);
  }

  @Get('projects/:projectId/specs')
  findSpecs(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: User,
  ) {
    return this.specsService.findAll(projectId, user.id);
  }

  @Get('specs/:id')
  findSpec(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.specsService.findOne(id, user.id);
  }

  @Put('specs/:id')
  updateSpec(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: UpdateSpecDto,
  ) {
    return this.specsService.update(id, user.id, dto);
  }

  @Delete('specs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSpec(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.specsService.remove(id, user.id);
  }

  @Put('specs/:id/artifacts/:type')
  updateArtifact(
    @Param('id', ParseIntPipe) id: number,
    @Param('type') type: ArtifactType,
    @CurrentUser() user: User,
    @Body() dto: UpdateArtifactDto,
  ) {
    return this.specsService.updateArtifact(id, type, user.id, dto);
  }

  @Post('specs/:id/generate-requirements')
  @UsePipes(new ValidationPipe({ errorHttpStatusCode: 400 }))
  generateRequirements(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: GenerateRequirementsDto,
  ) {
    return this.specsService.generateRequirements(id, user.id, dto);
  }

  @Post('specs/:id/generate-design')
  generateDesign(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.specsService.generateDesign(id, user.id);
  }

  @Post('specs/:id/generate-tasks')
  generateTasks(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.specsService.generateTasks(id, user.id);
  }

  // Artifact versions
  @Get('specs/:specId/artifacts/:type/versions')
  async getVersions(
    @Param('specId', ParseIntPipe) specId: number,
    @Param('type', new ParseEnumPipe(ArtifactTypeEnum)) type: ArtifactType,
    @CurrentUser() user: User,
  ) {
    await this.specsService.findOne(specId, user.id); // ownership check
    return this.versioningService.getVersions(specId, type);
  }

  @Get('specs/:specId/artifacts/:type/versions/:version')
  async getVersion(
    @Param('specId', ParseIntPipe) specId: number,
    @Param('type', new ParseEnumPipe(ArtifactTypeEnum)) type: ArtifactType,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser() user: User,
  ) {
    await this.specsService.findOne(specId, user.id); // ownership check
    return this.versioningService.getVersion(specId, type, version);
  }

  @Post('specs/:specId/artifacts/:type/versions/:version/restore')
  async restore(
    @Param('specId', ParseIntPipe) specId: number,
    @Param('type', new ParseEnumPipe(ArtifactTypeEnum)) type: ArtifactType,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser() user: User,
  ) {
    const spec = await this.specsService.findOne(specId, user.id); // ownership check
    return this.versioningService.restore(spec as unknown as import('../../database/entities/spec.entity.js').Spec, type, version, user.id);
  }

  @Get('specs/:specId/artifacts/:type/versions/:versionA/diff/:versionB')
  async getDiff(
    @Param('specId', ParseIntPipe) specId: number,
    @Param('type', new ParseEnumPipe(ArtifactTypeEnum)) type: ArtifactType,
    @Param('versionA', ParseIntPipe) versionA: number,
    @Param('versionB', ParseIntPipe) versionB: number,
    @CurrentUser() user: User,
  ) {
    await this.specsService.findOne(specId, user.id); // ownership check
    return this.versioningService.getDiff(specId, type, versionA, versionB);
  }
}
