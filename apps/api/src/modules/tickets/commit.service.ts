import {
  Injectable,
  UnprocessableEntityException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { simpleGit } from 'simple-git';
import { join } from 'path';
import { Ticket } from '../../database/entities/ticket.entity.js';
import { Execution } from '../../database/entities/execution.entity.js';
import { FileChange } from '../../database/entities/file-change.entity.js';
import { GitStderrSanitizer } from '../../common/git/git-stderr-sanitizer.js';

/**
 * CommitService: git add approved files + git commit in worktree.
 * Req 20.1–20.7: Never does git push; Worker never commits.
 */
@Injectable()
export class CommitService {
  private readonly logger = new Logger(CommitService.name);

  constructor(
    @InjectRepository(FileChange)
    private readonly fileChangeRepo: Repository<FileChange>,
    @InjectRepository(Execution)
    private readonly executionRepo: Repository<Execution>,
    private readonly config: ConfigService,
  ) {}

  async commit(ticket: Ticket): Promise<{ sha: string }> {
    const workspaceRoot = this.config.get<string>(
      'WORKSPACE_ROOT',
      './storage/app/workspaces',
    );

    // Find latest execution for this ticket to locate the worktree
    const execution = await this.executionRepo.findOne({
      where: { ticket_id: ticket.id },
      order: { created_at: 'DESC' },
    });

    if (!execution) {
      throw new UnprocessableEntityException('No execution found for this ticket');
    }

    const projectId = ticket.spec?.project_id ?? execution.project_id;
    // MUST match worker's getWorktreePath: WORKSPACE_ROOT/{projectId}/{ticketId}
    const worktreePath = join(
      workspaceRoot,
      String(projectId),
      String(ticket.id),
    );

    // Get approved file changes (Req 20.1)
    const approvedChanges = await this.fileChangeRepo.find({
      where: { execution_id: execution.id, review_status: 'approved' },
    });

    if (approvedChanges.length === 0) {
      // Req 20.1: 422 jika tidak ada approved files
      throw new UnprocessableEntityException(
        'No approved file changes found. Mark at least one file as approved before committing.',
      );
    }

    const git = simpleGit({ baseDir: worktreePath, timeout: { block: 60_000 } });

    try {
      // git add approved files (Req 20.2, timeout 60s)
      const filePaths = approvedChanges.map((c) => c.file_path);
      await git.add(filePaths);

      // git commit (Req 20.3, timeout 30s)
      const commitMessage = `${ticket.title}\n\nRef: ticket-${ticket.id}`;
      const result = await git.commit(commitMessage);

      this.logger.log(`Committed ticket-${ticket.id}: ${result.commit}`);
      return { sha: result.commit };
    } catch (err: unknown) {
      const rawStderr = err instanceof Error ? err.message : String(err);
      const sanitized = GitStderrSanitizer.sanitize(rawStderr);
      this.logger.error(`Commit failed for ticket-${ticket.id}: ${sanitized}`);

      // Reset staging area on failure (Req 20.6)
      try {
        await git.reset(['HEAD']);
      } catch {
        // best-effort reset
      }

      throw new InternalServerErrorException(
        `Git commit failed: ${sanitized}`,
      );
    }
  }
}
