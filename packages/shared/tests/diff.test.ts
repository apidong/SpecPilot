import { describe, it, expect } from 'vitest';
import { diff } from '../src/diff/line-diff.js';

describe('diff', () => {
  it('should return all unchanged for identical strings', () => {
    const result = diff('hello\nworld\n', 'hello\nworld\n');
    expect(result.lines.every((l) => l.kind === 'unchanged')).toBe(true);
  });

  it('should detect added lines', () => {
    const result = diff('line1\n', 'line1\nline2\n');
    const added = result.lines.filter((l) => l.kind === 'added');
    expect(added).toHaveLength(1);
    expect(added[0].text).toBe('line2');
  });

  it('should detect removed lines', () => {
    const result = diff('line1\nline2\n', 'line1\n');
    const removed = result.lines.filter((l) => l.kind === 'removed');
    expect(removed).toHaveLength(1);
    expect(removed[0].text).toBe('line2');
  });

  it('should handle empty strings', () => {
    const result = diff('', '');
    expect(result.lines).toHaveLength(0);
  });

  it('reconstruction property (P4): applying diff to A produces B', () => {
    const a = 'line1\nline2\nline3\n';
    const b = 'line1\nline2b\nline3\nline4\n';
    const result = diff(a, b);
    
    // Reconstruct B from diff
    const reconstructed = result.lines
      .filter((l) => l.kind !== 'removed')
      .map((l) => l.text)
      .join('\n');
    
    const bLines = b.split('\n').filter((l, i, arr) => !(i === arr.length - 1 && l === ''));
    const expectedB = bLines.join('\n');
    expect(reconstructed).toBe(expectedB);
  });
});
