import { runCommand } from './process.js';
import { reportVerification } from './callback.js';

interface VerificationSpec {
  type: string;
  command: string;
  cwd: string;
}

/**
 * Run verification commands after agent completes (Req 19).
 */
export async function runVerification(
  executionId: number,
  specs: VerificationSpec[],
): Promise<{ allPassed: boolean }> {
  let allPassed = true;

  for (const spec of specs) {
    const [cmd, ...args] = spec.command.split(' ');
    const start = Date.now();
    const result = await runCommand(cmd, args, { cwd: spec.cwd, timeout: 300_000 });
    const duration_ms = Date.now() - start;

    const status = result.exitCode === 0 ? 'passed' : 'failed';
    if (status === 'failed') allPassed = false;

    await reportVerification(executionId, {
      type: spec.type,
      command: spec.command,
      status,
      exit_code: result.exitCode,
      output: (result.stdout + result.stderr).substring(0, 50000),
      duration_ms,
    });
  }

  return { allPassed };
}
