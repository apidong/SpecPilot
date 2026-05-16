/**
 * EARS requirement format validator
 * EARS = Easy Approach to Requirements Syntax
 * Patterns: When/If/Where/While... [Actor] [action] [event], the [system] shall [response]
 */

const EARS_PATTERNS = [
  /\bWHEN\b.+\bSHALL\b/i,
  /\bIF\b.+\bTHEN\b.+\bSHALL\b/i,
  /\bWHERE\b.+\bSHALL\b/i,
  /\bWHILE\b.+\bSHALL\b/i,
  /\bTHE\s+\w+\s+SHALL\b/i,
];

export function isValidEarsRequirement(text: string): boolean {
  return EARS_PATTERNS.some((pattern) => pattern.test(text));
}

export function validateEarsRequirements(content: string): { valid: boolean; issues: string[] } {
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  const issues: string[] = [];

  const requirementLines = lines.filter(
    (l) => l.trim().match(/^\d+\.|^-\s/) && l.length > 20,
  );

  for (const line of requirementLines) {
    if (!isValidEarsRequirement(line)) {
      issues.push(`Line may not follow EARS format: "${line.substring(0, 60)}..."`);
    }
  }

  return { valid: issues.length === 0, issues };
}
