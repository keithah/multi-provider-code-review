import { Finding, Severity } from '../../types';

interface Pattern {
  regex: RegExp;
  title: string;
  message: string;
  severity: Severity;
}

const PATTERNS: Pattern[] = [
  {
    regex: /console\.log/,
    title: 'Console logging left in code',
    message: 'Remove debug logging before merging.',
    severity: 'minor',
  },
  {
    regex: /debugger;/,
    title: 'Debugger statement',
    message: 'Debugger statements should be removed.',
    severity: 'major',
  },
  {
    regex: /TODO|FIXME/,
    title: 'Unresolved TODO',
    message: 'Address TODOs or track them explicitly.',
    severity: 'minor',
  },
];

export function detectPatternFindings(
  filename: string,
  addedLines: Array<{ line: number; content: string }>
): Finding[] {
  const findings: Finding[] = [];

  for (const { line, content } of addedLines) {
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(content)) {
        findings.push({
          file: filename,
          line,
          severity: pattern.severity,
          title: pattern.title,
          message: pattern.message,
          provider: 'ast',
          providers: ['ast'],
        });
      }
    }
  }

  return findings;
}
