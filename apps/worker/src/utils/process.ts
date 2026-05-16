import { execa } from 'execa';
import path from 'path';

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
