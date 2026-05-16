import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { REDIS_HOST, REDIS_PORT, INTERNAL_API_URL, WORKER_SECRET, getWorktreePath } from '../config/paths.js';
import { reportStatus, reportChange, pushLogs } from '../utils/callback.js';
import { createWorktree, removeWorktree, getChangedFiles, getFileDiff, commitChanges } from '../utils/git.js';
import { spawnAgent } from '../utils/agent.js';
import { runVerification } from '../utils/verify.js';

// Shared Redis connection for pub/sub publishing — reused across all jobs
const sharedRedis = new Redis({ host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: 3 });

interface ExecutionJobData {
  executionId: number;
}

interface ExecutionDetails {
  id: number;
  ticket_id: number;
  project_id: number;
  status: string;
  ticket: {
    branch_name: string;
    spec?: {
      project?: {
        repository_url?: string;
        root_path?: string;
        test_command?: string;
        lint_command?: string;
        default_agent_id?: number;
      };
    };
  };
  agent?: {
    type: string;
    config_json?: {
      command?: string;
      args?: string[];
      api_key?: string;
      base_url?: string;
    };
  };
}

async function fetchExecution(executionId: number): Promise<ExecutionDetails> {
  const res = await fetch(
    `${INTERNAL_API_URL}/internal/executions/${executionId}`,
    { headers: { 'X-Worker-Secret': WORKER_SECRET } },
  );
  if (!res.ok) throw new Error(`Failed to fetch execution ${executionId}: ${res.status}`);
  return res.json() as Promise<ExecutionDetails>;
}

export async function processExecution(job: Job<ExecutionJobData>): Promise<void> {
  const { executionId } = job.data;
  let projectRepo = '';
  let worktreePath = '';

  try {
    const execution = await fetchExecution(executionId);
    projectRepo = execution.ticket.spec?.project?.root_path ?? '';
    const branchName = execution.ticket.branch_name;
    worktreePath = getWorktreePath(execution.project_id, execution.ticket_id);

    // Step 1: Preparing workspace
    await reportStatus(executionId, 'Preparing Workspace');
    await pushLogs(executionId, [{
      level: 'info',
      source: 'worker',
      message: `Preparing worktree at ${worktreePath}`,
    }]);

    await createWorktree(projectRepo, worktreePath, branchName);

    // Step 2: Running agent
    await reportStatus(executionId, 'Running Agent', { worktree_path: worktreePath });

    const agentCmd = execution.agent?.config_json?.command ?? 'claude';
    const agentArgs = execution.agent?.config_json?.args ?? ['--worktree', worktreePath];
    const agentEnv: Record<string, string> = {};
    if (execution.agent?.config_json?.api_key) {
      agentEnv['OPENAI_API_KEY'] = execution.agent.config_json.api_key;
    }

    const { exitCode, killed } = await spawnAgent(
      executionId,
      agentCmd,
      agentArgs,
      worktreePath,
      agentEnv,
      sharedRedis,
    );

    if (killed) {
      await reportStatus(executionId, 'Cancelled');
      return;
    }

    // Collect changed files BEFORE committing (Req 17)
    // git status --porcelain only shows uncommitted changes
    const changedFiles = await getChangedFiles(worktreePath);
    const fileChanges: Array<{
      file_path: string;
      change_type: string;
      additions: number;
      deletions: number;
      diff: string;
    }> = [];
    for (const file of changedFiles) {
      const changeType = file.status === 'A' ? 'added' : file.status === 'D' ? 'deleted' : 'modified';
      const diff = await getFileDiff(worktreePath, file.path);
      const additions = diff.split('\n').filter((l) => l.startsWith('+')).length;
      const deletions = diff.split('\n').filter((l) => l.startsWith('-')).length;
      fileChanges.push({ file_path: file.path, change_type: changeType, additions, deletions, diff });
    }

    // Step 3: Commit agent changes
    await commitChanges(worktreePath, `specpilot: automated changes for ticket ${execution.ticket_id}`);

    // Report changes after commit
    for (const change of fileChanges) {
      await reportChange(executionId, change);
    }

    // Step 4: Run verification (Req 19)
    await reportStatus(executionId, 'Running Verification');

    const verSpecs = [];
    if (execution.ticket.spec?.project?.test_command) {
      verSpecs.push({
        type: 'test',
        command: execution.ticket.spec.project.test_command,
        cwd: worktreePath,
      });
    }
    if (execution.ticket.spec?.project?.lint_command) {
      verSpecs.push({
        type: 'lint',
        command: execution.ticket.spec.project.lint_command,
        cwd: worktreePath,
      });
    }

    const { allPassed } = await runVerification(executionId, verSpecs);

    // Step 5: Final status
    if (exitCode !== 0) {
      await reportStatus(executionId, 'Failed', { exit_code: exitCode });
    } else if (allPassed) {
      await reportStatus(executionId, 'Waiting Review');
    } else {
      await reportStatus(executionId, 'Failed', { error_message: 'Verification failed' });
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Execution ${executionId} failed:`, msg);
    await reportStatus(executionId, 'Failed', { error_message: msg }).catch(console.error);
  } finally {
    if (worktreePath && projectRepo) {
      await removeWorktree(projectRepo, worktreePath).catch((e: unknown) =>
        console.error(`Failed to remove worktree ${worktreePath}:`, e),
      );
    }
  }
}

export function createWorker(): Worker<ExecutionJobData> {
  return new Worker<ExecutionJobData>(
    'execution',
    async (job) => processExecution(job),
    {
      connection: { host: REDIS_HOST, port: REDIS_PORT },
      concurrency: 1, // Req 11.9: defense in depth
    },
  );
}
