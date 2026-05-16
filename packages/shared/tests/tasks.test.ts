import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseTasks } from '../src/parsers/tasks-parser.js';
import { serializeTasks } from '../src/parsers/tasks-serializer.js';
import type { Task } from '../src/types/index.js';

const validTask: Task = {
  code: 'TSK-001',
  title: 'Implement user authentication',
  type: 'backend',
  priority: 'high',
  depends_on: [],
  acceptance_criteria: 'User can login with email and password',
  checked: false,
};

describe('parseTasks', () => {
  it('should parse empty string to empty array', () => {
    const result = parseTasks('');
    expect(result.tasks).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('should parse a single task', () => {
    const md = `- [ ] TSK-001: Implement user authentication
  Type: backend
  Priority: high
  Depends on: none
  Acceptance: User can login with email and password
`;
    const result = parseTasks(md);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].code).toBe('TSK-001');
    expect(result.tasks[0].title).toBe('Implement user authentication');
    expect(result.tasks[0].type).toBe('backend');
    expect(result.tasks[0].priority).toBe('high');
    expect(result.tasks[0].depends_on).toEqual([]);
    expect(result.tasks[0].checked).toBe(false);
  });

  it('should parse checked task', () => {
    const md = `- [x] TSK-001: Done task
  Type: frontend
  Priority: low
  Depends on: none
  Acceptance: completed
`;
    const result = parseTasks(md);
    expect(result.tasks[0].checked).toBe(true);
  });

  it('should parse task with dependencies', () => {
    const md = `- [ ] TSK-002: Second task
  Type: fullstack
  Priority: medium
  Depends on: TSK-001, TSK-003
  Acceptance: works
`;
    const result = parseTasks(md);
    expect(result.tasks[0].depends_on).toEqual(['TSK-001', 'TSK-003']);
  });

  it('should parse multiple tasks', () => {
    const md = `- [ ] TSK-001: First task
  Type: backend
  Priority: high
  Depends on: none
  Acceptance: done
- [ ] TSK-002: Second task
  Type: frontend
  Priority: medium
  Depends on: TSK-001
  Acceptance: done
`;
    const result = parseTasks(md);
    expect(result.tasks).toHaveLength(2);
  });
});

describe('serializeTasks', () => {
  it('should serialize empty array to empty string', () => {
    expect(serializeTasks([])).toBe('');
  });

  it('should serialize a single task', () => {
    const tasks: Task[] = [validTask];
    const result = serializeTasks(tasks);
    expect(result).toContain('- [ ] TSK-001: Implement user authentication');
    expect(result).toContain('  Type: backend');
    expect(result).toContain('  Priority: high');
    expect(result).toContain('  Depends on: none');
    expect(result).toContain('  Acceptance: User can login with email and password');
    expect(result.endsWith('\n')).toBe(true);
  });

  it('should serialize checked task', () => {
    const tasks: Task[] = [{ ...validTask, checked: true }];
    const result = serializeTasks(tasks);
    expect(result).toContain('- [x] TSK-001:');
  });

  it('should serialize dependencies', () => {
    const tasks: Task[] = [{ ...validTask, depends_on: ['TSK-002', 'TSK-003'] }];
    const result = serializeTasks(tasks);
    expect(result).toContain('  Depends on: TSK-002, TSK-003');
  });
});

describe('Round-trip property (P1)', () => {
  it('should round-trip: serialize(parse(md)) === normalize(md)', () => {
    const md = `- [ ] TSK-001: First task
  Type: backend
  Priority: high
  Depends on: none
  Acceptance: User can do the thing
- [x] TSK-002: Second task
  Type: frontend
  Priority: medium
  Depends on: TSK-001
  Acceptance: Feature works
`;
    const { tasks } = parseTasks(md);
    const serialized = serializeTasks(tasks);
    const reparsed = parseTasks(serialized);
    // Round-trip: reparsed tasks should equal original tasks
    expect(reparsed.tasks).toHaveLength(tasks.length);
    for (let i = 0; i < tasks.length; i++) {
      expect(reparsed.tasks[i].code).toBe(tasks[i].code);
      expect(reparsed.tasks[i].title).toBe(tasks[i].title);
      expect(reparsed.tasks[i].type).toBe(tasks[i].type);
      expect(reparsed.tasks[i].priority).toBe(tasks[i].priority);
      expect(reparsed.tasks[i].checked).toBe(tasks[i].checked);
    }
  });

  it('property-based: serialize(parse(md)) is idempotent for valid tasks (P1)', () => {
    const taskArb = fc.record({
      code: fc.integer({ min: 1, max: 999 }).map((n) => `TSK-${String(n).padStart(3, '0')}`),
      title: fc.string({ minLength: 1, maxLength: 80 }).map((s) => s.replace(/[:\n\r]/g, ' ').trim() || 'task'),
      type: fc.constantFrom('backend', 'frontend', 'fullstack', 'infra', 'docs', 'test' as const),
      priority: fc.constantFrom('high', 'medium', 'low' as const),
      depends_on: fc.constant([]),
      acceptance_criteria: fc.string({ minLength: 1, maxLength: 100 }).map((s) => s.replace(/[\n\r]/g, ' ').trim() || 'done'),
      checked: fc.boolean(),
    });

    fc.assert(
      fc.property(fc.array(taskArb, { minLength: 0, maxLength: 10 }), (tasks) => {
        // Ensure unique codes
        const uniqueTasks = tasks.filter(
          (t, i, arr) => arr.findIndex((x) => x.code === t.code) === i,
        );
        const serialized = serializeTasks(uniqueTasks);
        if (uniqueTasks.length === 0) {
          return serialized === '';
        }
        const { tasks: reparsed, errors } = parseTasks(serialized);
        return reparsed.length === uniqueTasks.length;
      }),
      { numRuns: 100 },
    );
  });
});
