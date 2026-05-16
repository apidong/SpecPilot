import { execa } from 'execa';
import path from 'path';
import os from 'os';

/**
 * Cross-platform process utilities using execa.
 */
export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
  } = {},
): Promise<RunResult> {
  try {
    const result = await execa(command, args, {
      cwd: options.cwd,
      timeout: options.timeout,
      env: { ...process.env, ...(options.env ?? {}) } as Record<string, string>,
      reject: false,
    });

    return {
      exitCode: result.exitCode ?? 0,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      exitCode: 1,
      stdout: '',
      stderr: msg,
    };
  }
}

/**
 * Sanitize git stderr output to remove credential tokens, API keys.
 */
export function sanitizeStderr(stderr: string): string {
  return stderr
    .replace(/https?:\/\/[^@\s]+@/g, 'https://[CREDENTIALS_REDACTED]@')
    .replace(/oauth2:[a-zA-Z0-9._-]+/g, 'oauth2:[REDACTED]')
    .replace(/token=[a-zA-Z0-9._-]+/g, 'token=[REDACTED]');
}

/**
 * killTree: cross-OS process tree termination with grace period.
 * - POSIX: SIGTERM on process group → wait graceMs → SIGKILL (Req 14.3–14.5)
 * - Windows: taskkill /T (graceful) → wait graceMs → taskkill /T /F (Req 14.4, 15.3)
 */
export async function killTree(
  child: ReturnType<typeof execa>,
  { graceMs = 10_000, reason = 'killed' }: { graceMs?: number; reason?: string } = {},
): Promise<void> {
  const isWindows = os.platform() === 'win32';
  const pid = child.pid;

  if (!pid) return;

  if (isWindows) {
    // Windows: use taskkill /T for graceful tree kill
    try {
      await execa('taskkill', ['/PID', String(pid), '/T'], { reject: false });
    } catch {
      // ignore
    }

    await new Promise<void>((resolve) => setTimeout(resolve, graceMs));

    // Force kill
    try {
      await execa('taskkill', ['/PID', String(pid), '/T', '/F'], { reject: false });
    } catch {
      // ignore
    }
  } else {
    // POSIX: kill the process group with SIGTERM
    try {
      // child.pid should be a process group leader when detached=true
      process.kill(-pid, 'SIGTERM');
    } catch {
      // Process may have already exited
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
    }

    await new Promise<void>((resolve) => setTimeout(resolve, graceMs));

    // Escalate to SIGKILL
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }
  }
}

