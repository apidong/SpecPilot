import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadGatewayException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Spec } from '../../database/entities/spec.entity.js';
import { SpecArtifact } from '../../database/entities/spec-artifact.entity.js';
import { Project } from '../../database/entities/project.entity.js';
import { ArtifactVersioningService } from './artifact-versioning.service.js';
import { LlmService } from '../llm/llm.service.js';
import {
  CreateSpecDto,
  UpdateSpecDto,
  UpdateArtifactDto,
  GenerateRequirementsDto,
} from './dto/spec.dto.js';
import type { ArtifactType } from '@specpilot/shared';
import { VALID_SPEC_STATUSES } from '@specpilot/shared';

@Injectable()
export class SpecsService {
  constructor(
    @InjectRepository(Spec)
    private readonly specRepo: Repository<Spec>,
    @InjectRepository(SpecArtifact)
    private readonly artifactRepo: Repository<SpecArtifact>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly versioningService: ArtifactVersioningService,
    private readonly llmService: LlmService,
  ) {}

  private async getProjectAndVerify(projectId: number, userId: number): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.user_id !== userId) throw new ForbiddenException('Access denied');
    return project;
  }

  private async getSpecAndVerify(specId: number, userId: number): Promise<Spec> {
    const spec = await this.specRepo.findOne({
      where: { id: specId },
      relations: ['project'],
    });
    if (!spec) throw new NotFoundException('Spec not found');
    if (spec.project.user_id !== userId) throw new ForbiddenException('Access denied');
    return spec;
  }

  async create(projectId: number, userId: number, dto: CreateSpecDto): Promise<Spec> {
    await this.getProjectAndVerify(projectId, userId);
    const spec = this.specRepo.create({
      project_id: projectId,
      title: dto.title,
      summary: dto.summary,
      status: 'Draft',
    });
    return this.specRepo.save(spec);
  }

  async findAll(projectId: number, userId: number): Promise<Spec[]> {
    await this.getProjectAndVerify(projectId, userId);
    return this.specRepo.find({
      where: { project_id: projectId },
      order: { updated_at: 'DESC' },
    });
  }

  async findOne(specId: number, userId: number): Promise<Omit<Spec, 'artifacts'> & { artifacts: Record<ArtifactType, SpecArtifact | null> }> {
    const spec = await this.getSpecAndVerify(specId, userId);

    // Load active artifacts for all three types (Req 4.4)
    const [requirements, design, tasks] = await Promise.all([
      this.artifactRepo.findOne({ where: { spec_id: specId, type: 'requirements', is_current: true } }),
      this.artifactRepo.findOne({ where: { spec_id: specId, type: 'design', is_current: true } }),
      this.artifactRepo.findOne({ where: { spec_id: specId, type: 'tasks', is_current: true } }),
    ]);

    return {
      ...(spec as Omit<Spec, 'artifacts'>),
      artifacts: {
        requirements: requirements ?? null,
        design: design ?? null,
        tasks: tasks ?? null,
      },
    };
  }

  async update(specId: number, userId: number, dto: UpdateSpecDto): Promise<Spec> {
    const spec = await this.getSpecAndVerify(specId, userId);

    if (dto.status && !VALID_SPEC_STATUSES.includes(dto.status)) {
      throw new BadRequestException(`Invalid status: ${dto.status}`);
    }

    Object.assign(spec, dto);
    return this.specRepo.save(spec);
  }

  async remove(specId: number, userId: number): Promise<void> {
    const spec = await this.getSpecAndVerify(specId, userId);
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(Spec, spec.id);
    });
  }

  async updateArtifact(
    specId: number,
    type: ArtifactType,
    userId: number,
    dto: UpdateArtifactDto,
  ): Promise<SpecArtifact> {
    const spec = await this.getSpecAndVerify(specId, userId);
    return this.versioningService.saveVersion(spec, type, dto.content, 'user', undefined, userId);
  }

  async generateRequirements(
    specId: number,
    userId: number,
    dto: GenerateRequirementsDto,
  ): Promise<SpecArtifact> {
    const spec = await this.getSpecAndVerify(specId, userId);

    const content = await this.llmService.generateRequirements(dto.prompt).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadGatewayException(`LLM error: ${msg}`);
    });

    return this.versioningService.saveVersion(spec, 'requirements', content, 'llm', 'Generated from prompt', userId);
  }

  async generateDesign(specId: number, userId: number): Promise<SpecArtifact> {
    const spec = await this.getSpecAndVerify(specId, userId);

    const requirementsArtifact = await this.artifactRepo.findOne({
      where: { spec_id: specId, type: 'requirements', is_current: true },
    });

    if (!requirementsArtifact) {
      throw new ConflictException('Requirements artifact not available. Generate requirements first.');
    }

    const content = await this.llmService.generateDesign(requirementsArtifact.content).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadGatewayException(`LLM error: ${msg}`);
    });

    return this.versioningService.saveVersion(spec, 'design', content, 'llm', 'Generated from requirements', userId);
  }

  async generateTasks(specId: number, userId: number): Promise<SpecArtifact> {
    const spec = await this.getSpecAndVerify(specId, userId);

    const designArtifact = await this.artifactRepo.findOne({
      where: { spec_id: specId, type: 'design', is_current: true },
    });

    if (!designArtifact) {
      throw new ConflictException('Design artifact not available. Generate design first.');
    }

    const content = await this.llmService.generateTasks(designArtifact.content).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadGatewayException(`LLM error: ${msg}`);
    });

    return this.versioningService.saveVersion(spec, 'tasks', content, 'llm', 'Generated from design', userId);
  }
}
