import { runCommand, sanitizeStderr } from './process.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Create a git worktree for isolated execution (Req 12).
 */
export async function createWorktree(
  repoPath: string,
  worktreePath: string,
  branchName: string,
): Promise<void> {
  // Ensure parent directory exists
  await fs.mkdir(path.dirname(worktreePath), { recursive: true });

  // Create new branch from HEAD if it doesn't exist
  const branchResult = await runCommand(
    'git',
    ['branch', branchName],
    { cwd: repoPath },
  );

  // Ignore error if branch already exists
  if (branchResult.exitCode !== 0 && !branchResult.stderr.includes('already exists')) {
    throw new Error(`Failed to create branch: ${sanitizeStderr(branchResult.stderr)}`);
  }

  const result = await runCommand(
    'git',
    ['worktree', 'add', worktreePath, branchName],
    { cwd: repoPath },
  );

  if (result.exitCode !== 0) {
    throw new Error(`Failed to create worktree: ${sanitizeStderr(result.stderr)}`);
  }
}

/**
 * Remove a git worktree.
 */
export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
): Promise<void> {
  await runCommand(
    'git',
    ['worktree', 'remove', '--force', worktreePath],
    { cwd: repoPath },
  );

  // Also prune stale worktree references
  await runCommand('git', ['worktree', 'prune'], { cwd: repoPath });
}

/**
 * Commit all changes in the worktree.
 */
export async function commitChanges(
  worktreePath: string,
  message: string,
): Promise<void> {
  await runCommand('git', ['add', '-A'], { cwd: worktreePath });

  const result = await runCommand(
    'git',
    ['commit', '-m', message, '--no-verify'],
    { cwd: worktreePath },
  );

  if (result.exitCode !== 0) {
    // Empty commit is not an error
    if (result.stdout.includes('nothing to commit')) return;
    throw new Error(`Failed to commit: ${sanitizeStderr(result.stderr)}`);
  }
}

/**
 * Get list of changed files in the worktree vs HEAD.
 */
export async function getChangedFiles(
  worktreePath: string,
): Promise<Array<{ path: string; status: string }>> {
  const result = await runCommand(
    'git',
    ['status', '--porcelain'],
    { cwd: worktreePath },
  );

  if (result.exitCode !== 0) return [];

  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => ({
      status: line.substring(0, 2).trim(),
      path: line.substring(3).trim(),
    }));
}

/**
 * Get unified diff for a file.
 */
export async function getFileDiff(
  worktreePath: string,
  filePath: string,
): Promise<string> {
  const result = await runCommand(
    'git',
    ['diff', 'HEAD', '--', filePath],
    { cwd: worktreePath },
  );

  return result.stdout;
}
