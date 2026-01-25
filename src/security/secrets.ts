import { FileChange, Finding } from '../types';
import { mapAddedLines } from '../utils/diff';

const SECRET_PATTERNS: Array<{ regex: RegExp; title: string; message: string }> = [
  // AWS Secrets
  {
    regex: /AKIA[0-9A-Z]{16}/,
    title: 'Possible AWS access key',
    message: 'Rotate the key immediately and remove it from source control.',
  },
  {
    regex: /aws_secret_access_key\s*=\s*[\w/+=]{40}/i,
    title: 'Possible AWS secret access key',
    message: 'Rotate the key immediately and remove it from source control.',
  },

  // Google Cloud Platform
  {
    regex: /AIza[0-9A-Za-z_-]{35}/,
    title: 'Possible Google API key',
    message: 'Rotate the key and restrict API key permissions. Remove from source control.',
  },
  {
    regex: /"type":\s*"service_account"/,
    title: 'Possible GCP service account JSON',
    message: 'Remove service account credentials immediately. Use environment variables or secret managers.',
  },

  // Azure
  {
    regex: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+/,
    title: 'Possible Azure storage connection string',
    message: 'Rotate the connection string and remove it from source control.',
  },
  {
    regex: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    title: 'Possible Azure client secret or UUID',
    message: 'If this is an Azure secret, rotate it immediately. Remove from source control.',
  },

  // Private Keys
  {
    regex: /-----BEGIN( RSA| DSA| EC| OPENSSH| PGP)? PRIVATE KEY-----/,
    title: 'Private key committed',
    message: 'Never commit private keys to the repository. Generate new keys and remove this one.',
  },

  // Slack
  {
    regex: /xox[baprs]-[0-9A-Za-z-]{10,48}/,
    title: 'Possible Slack token',
    message: 'Revoke the token immediately and remove it from the codebase.',
  },

  // GitHub
  {
    regex: /gh[pousr]_[0-9a-zA-Z]{36,255}/,
    title: 'Possible GitHub token',
    message: 'Revoke the token immediately at https://github.com/settings/tokens',
  },

  // Generic API Keys
  {
    regex: /(?:api[_-]?key|apikey|api[_-]?secret|apisecret)\s*[:=]\s*['"]([a-z0-9_-]{20,})['"]/i,
    title: 'Possible API key',
    message: 'Rotate the API key and remove it from source control. Use environment variables.',
  },

  // Database Connection Strings
  {
    regex: /(?:postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@[^\/]+/i,
    title: 'Possible database connection string with credentials',
    message: 'Remove credentials from connection strings. Use environment variables or secret managers.',
  },

  // JWT Tokens
  {
    regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    title: 'Possible JWT token',
    message: 'Remove JWT tokens from source code. Tokens should be generated at runtime.',
  },

  // Stripe Keys
  {
    regex: /sk_live_[0-9a-zA-Z]{24,}/,
    title: 'Possible Stripe secret key',
    message: 'Revoke the key immediately and remove it from source control.',
  },
  {
    regex: /rk_live_[0-9a-zA-Z]{24,}/,
    title: 'Possible Stripe restricted key',
    message: 'Revoke the key and remove it from source control.',
  },

  // Twilio
  {
    regex: /SK[0-9a-f]{32}/,
    title: 'Possible Twilio API key',
    message: 'Revoke the key and remove it from source control.',
  },

  // SendGrid
  {
    regex: /SG\.[0-9A-Za-z_-]{22}\.[0-9A-Za-z_-]{43}/,
    title: 'Possible SendGrid API key',
    message: 'Revoke the key and remove it from source control.',
  },

  // MailChimp
  {
    regex: /[0-9a-f]{32}-us[0-9]{1,2}/,
    title: 'Possible MailChimp API key',
    message: 'Revoke the key and remove it from source control.',
  },

  // Generic Passwords
  {
    regex: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]{8,})['"]/i,
    title: 'Possible hardcoded password',
    message: 'Remove hardcoded passwords. Use environment variables or secret managers.',
  },
];

export function detectSecrets(file: FileChange): Finding[] {
  const findings: Finding[] = [];
  if (isTestFile(file.filename)) {
    return findings;
  }
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

function isTestFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    lower.includes('__tests__') ||
    lower.includes('/tests/') ||
    lower.endsWith('.test.ts') ||
    lower.endsWith('.test.js') ||
    lower.endsWith('.spec.ts') ||
    lower.endsWith('.spec.js')
  );
}
