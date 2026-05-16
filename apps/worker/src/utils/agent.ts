import { execa, ExecaChildProcess } from 'execa';
import { ALLOWED_AGENT_COMMANDS, AGENT_TIMEOUT_MS, LOG_FLUSH_INTERVAL_MS } from '../config/paths.js';
import { pushLogs } from './callback.js';
import { Redis } from 'ioredis';

/**
 * Validate that the agent command is in the allowlist (Req 22).
 */
function validateAgentCommand(cmd: string): void {
  const base = cmd.split(/[\\/]/).pop() ?? '';
  if (!ALLOWED_AGENT_COMMANDS.includes(base.toLowerCase())) {
    throw new Error(`Agent command not allowed: ${cmd}. Allowed: ${ALLOWED_AGENT_COMMANDS.join(', ')}`);
  }
}

interface LogEntry {
  level: 'info' | 'warn' | 'error';
  source: 'agent' | 'worker';
  message: string;
}

/**
 * Spawn the agent process with log streaming and stop signal handling (Req 15, 22).
 */
export async function spawnAgent(
  executionId: number,
  agentCmd: string,
  agentArgs: string[],
  cwd: string,
  env: Record<string, string>,
  redis: Redis,
): Promise<{ exitCode: number; killed: boolean }> {
  validateAgentCommand(agentCmd);

  const logBuffer: LogEntry[] = [];
  let killed = false;

  // Flush log buffer periodically (Req 16.4)
  const flushInterval = setInterval(async () => {
    if (logBuffer.length > 0) {
      const toFlush = logBuffer.splice(0, logBuffer.length);
      await pushLogs(executionId, toFlush).catch(console.error);
    }
  }, LOG_FLUSH_INTERVAL_MS);

  // Subscribe to stop signal (Req 15.1)
  const stopSubscriber = new Redis({
    host: redis.options.host,
    port: redis.options.port as number,
  });

  let childProcess: ExecaChildProcess | undefined;

  await stopSubscriber.subscribe(`execution-stop:${executionId}`);
  stopSubscriber.on('message', (_channel: string, _message: string) => {
    killed = true;
    childProcess?.kill('SIGTERM');
  });

  try {
    childProcess = execa(agentCmd, agentArgs, {
      cwd,
      timeout: AGENT_TIMEOUT_MS,
      env: { ...process.env, ...env } as Record<string, string>,
      all: true,
      reject: false,
    });

    // Stream stdout
    childProcess.stdout?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        logBuffer.push({ level: 'info', source: 'agent', message: line });
      }
    });

    // Stream stderr
    childProcess.stderr?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        logBuffer.push({ level: 'error', source: 'agent', message: line });
      }
    });

    const result = await childProcess;
    return { exitCode: result.exitCode ?? 0, killed };
  } finally {
    clearInterval(flushInterval);
    await stopSubscriber.unsubscribe();
    stopSubscriber.disconnect();

    // Final flush
    if (logBuffer.length > 0) {
      await pushLogs(executionId, logBuffer).catch(console.error);
    }
  }
}
