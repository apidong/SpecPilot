/**
 * Sanitize Git stderr output to remove sensitive credentials.
 * Req 3.5, 3.8, 20.6
 */
export class GitStderrSanitizer {
  private static readonly PATTERNS = [
    // Remove credentials from HTTPS URLs: https://user:token@github.com
    /https?:\/\/[^:]+:[^@]+@/gi,
    // Remove password=... and token=... patterns
    /password=[^\s&]*/gi,
    /token=[^\s&]*/gi,
    // Remove Authorization header values
    /Authorization:\s*Basic\s+\S+/gi,
    /Authorization:\s*Bearer\s+\S+/gi,
    // Remove SSH key paths (configurable)
    /\/[^\s]*\.pem/gi,
    /\/[^\s]*\.key/gi,
    /\/[^\s]*id_rsa[^\s]*/gi,
    /\/[^\s]*id_ed25519[^\s]*/gi,
  ];

  static sanitize(stderr: string, sshKeyPath?: string): string {
    let sanitized = stderr;

    for (const pattern of this.PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    // Remove specific SSH key path if provided
    if (sshKeyPath) {
      const escapedPath = sshKeyPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      sanitized = sanitized.replace(new RegExp(escapedPath, 'gi'), '[REDACTED]');
    }

    return sanitized;
  }
}
