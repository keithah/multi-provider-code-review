import { detectSecrets } from '../../src/security/secrets';
import { FileChange } from '../../src/types';

describe('detectSecrets', () => {
  it('reports added secrets with correct line numbers', () => {
    const file: FileChange = {
      filename: 'app.ts',
      status: 'modified',
      additions: 2,
      deletions: 0,
      changes: 2,
      patch: `@@ -1,2 +1,3 @@\n line1\n+const key = "AKIA1234567890ABCDEF";\n line2\n`,
    };

    const findings = detectSecrets(file);
    expect(findings).toHaveLength(1);
    expect(findings[0].line).toBe(2);
    expect(findings[0].provider).toBe('security');
    expect(findings[0].providers).toEqual(['security']);
  });
});
