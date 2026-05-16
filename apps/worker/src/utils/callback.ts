import { INTERNAL_API_URL, WORKER_SECRET } from '../config/paths.js';
import type { ExecutionStatus } from '@specpilot/shared';

const headers = {
  'Content-Type': 'application/json',
  'X-Worker-Secret': WORKER_SECRET,
};

/**
 * Report execution status to Internal API (Req 15.3).
 */
export async function reportStatus(
  executionId: number,
  status: ExecutionStatus,
  extras: Record<string, unknown> = {},
): Promise<void> {
  const res = await fetch(
    `${INTERNAL_API_URL}/internal/executions/${executionId}/status`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status, ...extras }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to report status ${status}: ${res.status} ${text}`);
  }
}

/**
 * Batch push logs to Internal API (Req 16.3).
 */
export async function pushLogs(
  executionId: number,
  logs: Array<{
    level: 'info' | 'warn' | 'error' | 'debug';
    source: 'agent' | 'worker' | 'system';
    message: string;
    metadata?: Record<string, unknown>;
  }>,
): Promise<void> {
  if (logs.length === 0) return;

  const res = await fetch(
    `${INTERNAL_API_URL}/internal/executions/${executionId}/logs`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ logs }),
    },
  );

  if (!res.ok) {
    console.error(`Failed to push logs: ${res.status}`);
  }
}

/**
 * Report a file change to Internal API (Req 17.1).
 */
export async function reportChange(
  executionId: number,
  change: {
    file_path: string;
    change_type: 'added' | 'modified' | 'deleted';
    additions?: number;
    deletions?: number;
    diff?: string;
  },
): Promise<void> {
  const res = await fetch(
    `${INTERNAL_API_URL}/internal/executions/${executionId}/changes`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(change),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to report change: ${res.status} ${text}`);
  }
}

/**
 * Report verification result to Internal API (Req 19.4).
 */
export async function reportVerification(
  executionId: number,
  result: {
    type: string;
    command: string;
    status: 'passed' | 'failed' | 'skipped' | 'error';
    exit_code?: number;
    output?: string;
    duration_ms?: number;
  },
): Promise<void> {
  const res = await fetch(
    `${INTERNAL_API_URL}/internal/executions/${executionId}/verification`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(result),
    },
  );

  if (!res.ok) {
    console.error(`Failed to report verification: ${res.status}`);
  }
}
