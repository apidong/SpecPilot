import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn().mockResolvedValue({
    exitCode: 0,
    stdout: 'Build passed',
    stderr: '',
  }),
}));

import { runCommand, sanitizeStderr } from '../src/utils/process.js';

describe('sanitizeStderr (P7: Sandbox credential sanitization)', () => {
  it('should redact HTTPS credentials from git URLs', () => {
    const stderr = 'fatal: Authentication failed for https://user:token123@github.com/org/repo.git';
    const result = sanitizeStderr(stderr);
    expect(result).not.toContain('user:token123');
    expect(result).toContain('[CREDENTIALS_REDACTED]');
  });

  it('should redact oauth2 tokens', () => {
    const stderr = 'remote: error with oauth2:ghp_abcdef123456token';
    const result = sanitizeStderr(stderr);
    expect(result).not.toContain('ghp_abcdef123456token');
    expect(result).toContain('[REDACTED]');
  });

  it('should pass through safe stderr unchanged', () => {
    const stderr = 'warning: LF will be replaced by CRLF in some files';
    const result = sanitizeStderr(stderr);
    expect(result).toBe(stderr);
  });
});

describe('runCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return stdout and exitCode', async () => {
    const { execa } = await import('execa');
    (execa as any).mockResolvedValue({ exitCode: 0, stdout: 'success', stderr: '' });

    const result = await runCommand('git', ['status']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('success');
  });

  it('should handle non-zero exit codes gracefully', async () => {
    const { execa } = await import('execa');
    (execa as any).mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'error message' });

    const result = await runCommand('git', ['bad-command']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('error message');
  });

  it('should catch exceptions and return exitCode 1', async () => {
    const { execa } = await import('execa');
    (execa as any).mockRejectedValue(new Error('command not found'));

    const result = await runCommand('nonexistent', []);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('command not found');
  });
});
