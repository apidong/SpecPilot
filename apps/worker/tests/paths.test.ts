import { describe, it, expect } from 'vitest';
import { getWorktreePath, ALLOWED_AGENT_COMMANDS } from '../src/config/paths.js';
import path from 'path';

describe('paths config (P7: Cross-platform sandbox)', () => {
  it('getWorktreePath returns cross-platform path', () => {
    const result = getWorktreePath(5, 10);
    // Should use path.join - contains both IDs
    expect(result).toContain('5');
    expect(result).toContain('10');
    // Should not use Windows backslash directly
    const normalized = result.replace(/\\/g, '/');
    expect(normalized).toContain('/5/10');
  });

  it('ALLOWED_AGENT_COMMANDS contains expected agents', () => {
    expect(ALLOWED_AGENT_COMMANDS).toContain('claude');
    expect(ALLOWED_AGENT_COMMANDS).toContain('aider');
    expect(ALLOWED_AGENT_COMMANDS).toContain('opencode');
  });

  it('ALLOWED_AGENT_COMMANDS does not contain dangerous commands', () => {
    expect(ALLOWED_AGENT_COMMANDS).not.toContain('bash');
    expect(ALLOWED_AGENT_COMMANDS).not.toContain('sh');
    expect(ALLOWED_AGENT_COMMANDS).not.toContain('cmd');
    expect(ALLOWED_AGENT_COMMANDS).not.toContain('powershell');
    expect(ALLOWED_AGENT_COMMANDS).not.toContain('rm');
  });

  it('ALLOWED_AGENT_COMMANDS is frozen (immutable)', () => {
    expect(Object.isFrozen(ALLOWED_AGENT_COMMANDS)).toBe(true);
  });
});
