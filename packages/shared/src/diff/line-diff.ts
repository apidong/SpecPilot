import type { DiffResult, DiffLine } from '../types/index.js';

/**
 * Myers diff algorithm (line-based)
 * Req 9.10
 */
export function diff(a: string, b: string): DiffResult {
  const aLines = a.split('\n');
  const bLines = b.split('\n');

  // Remove trailing empty line from split if content ends with \n
  if (aLines[aLines.length - 1] === '') aLines.pop();
  if (bLines[bLines.length - 1] === '') bLines.pop();

  const lcs = computeLCS(aLines, bLines);
  const result: DiffLine[] = [];

  let ai = 0;
  let bi = 0;
  let li = 0;

  while (ai < aLines.length || bi < bLines.length) {
    if (ai < aLines.length && bi < bLines.length && li < lcs.length && aLines[ai] === lcs[li] && bLines[bi] === lcs[li]) {
      result.push({ kind: 'unchanged', text: aLines[ai], aLineNo: ai + 1, bLineNo: bi + 1 });
      ai++;
      bi++;
      li++;
    } else if (bi < bLines.length && (li >= lcs.length || bLines[bi] !== lcs[li])) {
      result.push({ kind: 'added', text: bLines[bi], bLineNo: bi + 1 });
      bi++;
    } else {
      result.push({ kind: 'removed', text: aLines[ai], aLineNo: ai + 1 });
      ai++;
    }
  }

  return { lines: result };
}

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const lcs: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}
