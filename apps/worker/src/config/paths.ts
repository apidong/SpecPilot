import path from 'path';

// Resolve workspace root from env (cross-platform safe)
export const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT
  ? path.resolve(process.env.WORKSPACE_ROOT)
  : path.resolve('./storage/app/workspaces');

// Worker callback base URL (Internal API)
export const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';

// Worker secret (for X-Worker-Secret header)
export const WORKER_SECRET = process.env.WORKER_SECRET ?? '';

// Redis connection
export const REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
export const REDIS_PORT = parseInt(process.env.REDIS_PORT ?? '6379', 10);

// Allowed agent CLI commands whitelist (Req 22)
export const ALLOWED_AGENT_COMMANDS: readonly string[] = Object.freeze([
  'claude',
  'aider',
  'codex',
  'opencode',
  'cursor',
]);

// Agent spawn timeout (30 minutes)
export const AGENT_TIMEOUT_MS = 30 * 60 * 1000;

// Log batch flush interval
export const LOG_FLUSH_INTERVAL_MS = 500;

export function getWorktreePath(projectId: number, ticketId: number): string {
  return path.join(WORKSPACE_ROOT, String(projectId), String(ticketId));
}
