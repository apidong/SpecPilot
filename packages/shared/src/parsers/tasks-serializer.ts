import type { Task } from '../types/index.js';

/**
 * Serialize Task array into canonical markdown checklist format.
 * Req 8.5, 8.6, 8.7
 * 
 * Canonical format:
 * - [ ] TSK-001: Title
 *   Type: backend
 *   Priority: high
 *   Depends on: TSK-002, TSK-003
 *   Acceptance: description
 */
export function serializeTasks(tasks: Task[]): string {
  if (!tasks || tasks.length === 0) {
    return '';
  }

  const lines: string[] = [];

  for (const task of tasks) {
    const check = task.checked ? 'x' : ' ';
    lines.push(`- [${check}] ${task.code}: ${task.title}`);
    lines.push(`  Type: ${task.type}`);
    lines.push(`  Priority: ${task.priority}`);
    const depStr = task.depends_on.length > 0 ? task.depends_on.join(', ') : 'none';
    lines.push(`  Depends on: ${depStr}`);
    lines.push(`  Acceptance: ${task.acceptance_criteria}`);
  }

  return lines.join('\n') + '\n';
}
