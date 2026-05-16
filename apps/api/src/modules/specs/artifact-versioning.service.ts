import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SpecArtifact } from '../../database/entities/spec-artifact.entity.js';
import { Spec } from '../../database/entities/spec.entity.js';
import type { ArtifactType } from '@specpilot/shared';
import { diff } from '@specpilot/shared';

const MAX_VERSIONS_PER_ARTIFACT = 50;

@Injectable()
export class ArtifactVersioningService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(SpecArtifact)
    private readonly artifactRepo: Repository<SpecArtifact>,
  ) {}

  async saveVersion(
    spec: Spec,
    type: ArtifactType,
    content: string,
    generatedBy: 'llm' | 'user',
    changeSummary?: string,
    createdBy?: number,
  ): Promise<SpecArtifact> {
    if (!['llm', 'user'].includes(generatedBy)) {
      throw new BadRequestException('generated_by must be llm or user');
    }

    return this.dataSource.transaction(async (manager) => {
      // Lock current version (Req 9.2, 9.4)
      const current = await manager
        .createQueryBuilder(SpecArtifact, 'a')
        .setLock('pessimistic_write')
        .where('a.spec_id = :specId', { specId: spec.id })
        .andWhere('a.type = :type', { type })
        .andWhere('a.is_current = :flag', { flag: true })
        .getOne();

      const newVersion = (current?.version ?? 0) + 1;

      // Demote current (Req 9.2)
      if (current) {
        await manager.update(SpecArtifact, { id: current.id }, { is_current: false });
      }

      // Insert new row (Req 9.4, 9.5)
      const row = manager.create(SpecArtifact, {
        spec_id: spec.id,
        type,
        content,
        version: newVersion,
        parent_id: current?.id ?? undefined,
        is_current: true,
        generated_by: generatedBy,
        change_summary: changeSummary,
        created_by: createdBy,
      });
      const saved = await manager.save(row);

      // Prune if needed (Req 9.6, 9.12)
      await this.pruneIfNeeded(manager, spec.id, type);

      return saved;
    });
  }

  private async pruneIfNeeded(
    manager: DataSource['manager'],
    specId: number,
    type: ArtifactType,
  ): Promise<void> {
    const total = await manager.count(SpecArtifact, {
      where: { spec_id: specId, type },
    });
    if (total <= MAX_VERSIONS_PER_ARTIFACT) return;

    let toRemove = total - MAX_VERSIONS_PER_ARTIFACT;

    // First pass: oldest LLM versions (Req 9.12 LLM-first)
    const llmRows = await manager.find(SpecArtifact, {
      where: { spec_id: specId, type, is_current: false, generated_by: 'llm' },
      order: { version: 'ASC' },
      take: toRemove,
    });
    if (llmRows.length > 0) {
      await manager.delete(
        SpecArtifact,
        llmRows.map((r) => r.id),
      );
      toRemove -= llmRows.length;
    }

    // Second pass: oldest user versions if still over budget (never is_current=true)
    if (toRemove > 0) {
      const userRows = await manager.find(SpecArtifact, {
        where: { spec_id: specId, type, is_current: false, generated_by: 'user' },
        order: { version: 'ASC' },
        take: toRemove,
      });
      if (userRows.length > 0) {
        await manager.delete(
          SpecArtifact,
          userRows.map((r) => r.id),
        );
      }
    }
  }

  async getVersions(specId: number, type: ArtifactType): Promise<SpecArtifact[]> {
    return this.artifactRepo.find({
      where: { spec_id: specId, type },
      order: { version: 'DESC' },
    });
  }

  async getVersion(specId: number, type: ArtifactType, version: number): Promise<SpecArtifact> {
    const artifact = await this.artifactRepo.findOne({
      where: { spec_id: specId, type, version },
    });
    if (!artifact) throw new NotFoundException('Artifact version not found');
    return artifact;
  }

  async restore(
    spec: Spec,
    type: ArtifactType,
    version: number,
    userId: number,
  ): Promise<SpecArtifact> {
    const source = await this.getVersion(spec.id, type, version);
    return this.saveVersion(
      spec,
      type,
      source.content,
      'user',
      `Restored from version ${version}`,
      userId,
    );
  }

  async getDiff(
    specId: number,
    type: ArtifactType,
    versionA: number,
    versionB: number,
  ) {
    const [a, b] = await Promise.all([
      this.getVersion(specId, type, versionA),
      this.getVersion(specId, type, versionB),
    ]);
    return diff(a.content, b.content);
  }

  async getCurrent(specId: number, type: ArtifactType): Promise<SpecArtifact | null> {
    return this.artifactRepo.findOne({
      where: { spec_id: specId, type, is_current: true },
    });
  }
}
