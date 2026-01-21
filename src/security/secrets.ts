import { FileChange, Finding } from '../types';
import { mapAddedLines } from '../utils/diff';

const SECRET_PATTERNS: Array<{ regex: RegExp; title: string; message: string }> = [
  {
    regex: /AKIA[0-9A-Z]{16}/,
    title: 'Possible AWS access key',
    message: 'Rotate the key and remove it from source control.',
  },
  {
    regex: /-----BEGIN( RSA)? PRIVATE KEY-----/,
    title: 'Private key committed',
    message: 'Never commit private keys to the repository.',
  },
  {
    regex: /xox[baprs]-[0-9A-Za-z-]{10,48}/,
    title: 'Possible Slack token',
    message: 'Revoke the token and remove it from the codebase.',
  },
];

export function detectSecrets(file: FileChange): Finding[] {
  const findings: Finding[] = [];
  const addedLines = mapAddedLines(file.patch);

  for (const { line, content } of addedLines) {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(content)) {
        findings.push({
          file: file.filename,
          line,
          severity: 'critical',
          title: pattern.title,
          message: pattern.message,
          provider: 'security',
          providers: ['security'],
        });
      }
    }
  }

  return findings;
}
