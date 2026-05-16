import type { Task, TaskType, TaskPriority } from '../types/index.js';

// Grammar for task markdown:
// - [ ] TSK-001: Title
//   Type: backend
//   Priority: high
//   Depends on: TSK-002, TSK-003 (or "none")
//   Acceptance: description

const VALID_TYPES: TaskType[] = ['backend', 'frontend', 'fullstack', 'infra', 'docs', 'test'];
const VALID_PRIORITIES: TaskPriority[] = ['high', 'medium', 'low'];
const TASK_CODE_RE = /^TSK-(\d{3})$/;
const TASK_LINE_RE = /^- \[([ x])\] (TSK-\d{3}): (.+)$/;

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  tasks: Task[];
  errors: ParseError[];
}

/**
 * Parse markdown checklist tasks into structured Task array.
 * Req 8.1, 8.2, 8.3, 8.4
 */
export function parseTasks(markdown: string): ParseResult {
  if (!markdown || markdown.trim() === '') {
    return { tasks: [], errors: [] };
  }

  const lines = markdown.split('\n');
  const tasks: Task[] = [];
  const errors: ParseError[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const taskMatch = TASK_LINE_RE.exec(line);

    if (taskMatch) {
      const checked = taskMatch[1] === 'x';
      const code = taskMatch[2];
      const title = taskMatch[3].trim();

      if (!TASK_CODE_RE.test(code)) {
        errors.push({ line: i + 1, message: `Invalid task code: ${code}` });
        i++;
        continue;
      }

      if (!title || title.length > 200) {
        errors.push({ line: i + 1, message: `Title must be 1-200 characters: ${code}` });
        i++;
        continue;
      }

      // Parse sub-fields
      let type: TaskType | undefined;
      let priority: TaskPriority | undefined;
      let depends_on: string[] = [];
      let acceptance_criteria = '';

      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i].trim() === '')) {
        const subLine = lines[i].trim();

        if (subLine.startsWith('Type:')) {
          const val = subLine.replace('Type:', '').trim().toLowerCase() as TaskType;
          if (VALID_TYPES.includes(val)) {
            type = val;
          } else {
            errors.push({ line: i + 1, message: `Invalid type "${val}" for ${code}` });
          }
        } else if (subLine.startsWith('Priority:')) {
          const val = subLine.replace('Priority:', '').trim().toLowerCase() as TaskPriority;
          if (VALID_PRIORITIES.includes(val)) {
            priority = val;
          } else {
            errors.push({ line: i + 1, message: `Invalid priority "${val}" for ${code}` });
          }
        } else if (subLine.startsWith('Depends on:')) {
          const depStr = subLine.replace('Depends on:', '').trim();
          if (depStr.toLowerCase() === 'none') {
            depends_on = [];
          } else {
            depends_on = depStr
              .split(',')
              .map((d) => d.trim())
              .filter((d) => TASK_CODE_RE.test(d));
          }
        } else if (subLine.startsWith('Acceptance:')) {
          acceptance_criteria = subLine.replace('Acceptance:', '').trim();
        }

        i++;
      }

      if (!type) {
        errors.push({ line: i, message: `Missing or invalid Type for ${code}` });
        type = 'backend'; // default
      }
      if (!priority) {
        errors.push({ line: i, message: `Missing or invalid Priority for ${code}` });
        priority = 'medium'; // default
      }
      if (!acceptance_criteria) {
        acceptance_criteria = 'N/A';
      }

      tasks.push({
        code,
        title,
        type,
        priority,
        depends_on,
        acceptance_criteria,
        checked,
      });
    } else {
      i++;
    }
  }

  return { tasks, errors };
}
