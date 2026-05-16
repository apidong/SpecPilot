import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

/**
 * Sandbox enforcement for worker processes.
 * Req 22.1–22.6: allowlist, privilege check, cwd enforcement.
 */

/**
 * Normalize a command basename for allowlist comparison.
 * Windows: lowercase + strip .exe/.cmd/.bat/.ps1/.com
 * POSIX: case-sensitive basename
 */
export function normalizeCommandBasename(cmd: string): string {
  const base = path.basename(cmd);
  if (os.platform() === 'win32') {
    return base
      .toLowerCase()
      .replace(/\.(exe|cmd|bat|ps1|com)$/i, '');
  }
  return base;
}

/**
 * Enforce command is in allowlist (Req 22.1, 22.3).
 * Throws if command not allowed.
 */
export function enforceAllowlist(cmd: string, allowlist: readonly string[]): void {
  const normalized = normalizeCommandBasename(cmd);
  const allowed = allowlist.map((a) =>
    os.platform() === 'win32' ? a.toLowerCase() : a,
  );

  if (!allowed.includes(normalized)) {
    throw new Error(
      `Command not allowed by sandbox: "${cmd}". Allowed: ${allowlist.join(', ')}`,
    );
  }
}

/**
 * Enforce that cwd is a descendant of worktreeRoot (Req 22.5, 22.6).
 * Rejects paths with ".." traversal.
 * Case-insensitive on Windows.
 */
export function enforceCwd(cwd: string, worktreeRoot: string): void {
  const resolvedCwd = path.resolve(cwd);
  const resolvedRoot = path.resolve(worktreeRoot);

  // Reject path traversal
  if (cwd.includes('..') || resolvedCwd.includes('..')) {
    throw new Error(`Path traversal detected in cwd: "${cwd}"`);
  }

  const isWindows = os.platform() === 'win32';
  const cwdNorm = isWindows ? resolvedCwd.toLowerCase() : resolvedCwd;
  const rootNorm = isWindows ? resolvedRoot.toLowerCase() : resolvedRoot;

  // cwd must be root itself or a descendant
  if (cwdNorm !== rootNorm && !cwdNorm.startsWith(rootNorm + path.sep)) {
    throw new Error(
      `cwd "${resolvedCwd}" is outside allowed worktree root "${resolvedRoot}"`,
    );
  }
}

/**
 * Check that the current process is NOT running as root (POSIX) or
 * as a member of the Administrators group (Windows).
 * Req 22.4: Exit non-zero if privileged.
 */
export function assertNotPrivileged(): void {
  if (os.platform() === 'win32') {
    // Check Windows Administrators SID S-1-5-32-544
    try {
      const output = execSync('whoami /groups', { encoding: 'utf8' });
      if (output.includes('S-1-5-32-544')) {
        console.error(
          '[SANDBOX] Worker must not run as Administrator. Exiting.',
        );
        process.exit(1);
      }
    } catch {
      // If whoami fails, we cannot determine — fail safe
      console.error('[SANDBOX] Could not verify user privileges. Exiting.');
      process.exit(1);
    }
  } else {
    // POSIX: check root UID
    if (process.getuid?.() === 0) {
      console.error('[SANDBOX] Worker must not run as root. Exiting.');
      process.exit(1);
    }
  }
}

/**
 * Validate that the allowlist is non-empty and contains only non-empty strings.
 * Req 22.2: Exit non-zero if allowlist is empty/invalid.
 */
export function validateAllowlist(allowlist: readonly string[]): void {
  if (!allowlist || allowlist.length === 0) {
    console.error('[SANDBOX] Allowlist is empty. Worker cannot start without an allowlist. Exiting.');
    process.exit(1);
  }

  for (const entry of allowlist) {
    if (!entry || typeof entry !== 'string' || entry.trim() === '') {
      console.error(`[SANDBOX] Invalid allowlist entry: "${entry}". Exiting.`);
      process.exit(1);
    }
  }
}
