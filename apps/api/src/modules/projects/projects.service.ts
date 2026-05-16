import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { simpleGit } from 'simple-git';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { Project } from '../../database/entities/project.entity.js';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto.js';
import { GitStderrSanitizer } from '../../common/git/git-stderr-sanitizer.js';
import { InjectRedis } from '../../common/redis/redis.module.js';
import { Redis } from 'ioredis';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  async create(userId: number, dto: CreateProjectDto): Promise<Project> {
    const project = this.projectRepo.create({
      user_id: userId,
      ...dto,
    });
    return this.projectRepo.save(project);
  }

  async findAll(userId: number, page = 1, limit = 50): Promise<{ data: Project[]; total: number }> {
    const [data, total] = await this.projectRepo.findAndCount({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
      skip: (page - 1) * limit,
      take: Math.min(limit, 50),
    });
    return { data, total };
  }

  async findOne(projectId: number, userId: number): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.user_id !== userId) throw new ForbiddenException('Access denied');
    return project;
  }

  async update(projectId: number, userId: number, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(projectId, userId);
    Object.assign(project, dto);
    return this.projectRepo.save(project);
  }

  async remove(projectId: number, userId: number): Promise<void> {
    const project = await this.findOne(projectId, userId);
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(Project, project.id);
    });
  }

  async cloneRepository(projectId: number, userId: number, workspaceRoot: string): Promise<{ status: string }> {
    const project = await this.findOne(projectId, userId);
    const repoPath = join(workspaceRoot, String(projectId), 'repo-main');

    // Check if already cloned (Req 3.2)
    if (existsSync(repoPath) && existsSync(join(repoPath, '.git'))) {
      throw new ConflictException('Repository already cloned');
    }

    // Acquire git lock (Req 3.7)
    const lockKey = `git:lock:project:${projectId}`;
    const locked = await this.redis.set(lockKey, '1', 'EX', 600, 'NX');
    if (!locked) {
      throw new ConflictException('Git operation already in progress for this project');
    }

    try {
      mkdirSync(repoPath, { recursive: true });
      const git = simpleGit({ timeout: { block: 300000 } });

      try {
        await git.clone(project.repository_url, repoPath, ['--no-tags', '--depth=1']);
      } catch (err: unknown) {
        // Cleanup partial clone (Req 3.6, 1.9)
        if (existsSync(repoPath)) {
          rmSync(repoPath, { recursive: true, force: true });
        }
        const errorMsg = err instanceof Error ? err.message : String(err);
        throw new InternalServerErrorException(
          GitStderrSanitizer.sanitize(errorMsg, project.ssh_key_path),
        );
      }

      return { status: 'cloned' };
    } finally {
      await this.redis.del(lockKey);
    }
  }

  async syncRepository(projectId: number, userId: number, workspaceRoot: string): Promise<{ status: string }> {
    const project = await this.findOne(projectId, userId);
    const repoPath = join(workspaceRoot, String(projectId), 'repo-main');

    // Check repo exists (Req 3.4)
    if (!existsSync(repoPath) || !existsSync(join(repoPath, '.git'))) {
      throw new NotFoundException('Repository not cloned yet');
    }

    // Acquire git lock (Req 3.7)
    const lockKey = `git:lock:project:${projectId}`;
    const locked = await this.redis.set(lockKey, '1', 'EX', 600, 'NX');
    if (!locked) {
      throw new ConflictException('Git operation already in progress for this project');
    }

    try {
      const git = simpleGit(repoPath, { timeout: { block: 120000 } });

      try {
        await git.fetch(['--all']);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        throw new InternalServerErrorException(
          GitStderrSanitizer.sanitize(errorMsg, project.ssh_key_path),
        );
      }

      return { status: 'synced' };
    } finally {
      await this.redis.del(lockKey);
    }
  }
}
