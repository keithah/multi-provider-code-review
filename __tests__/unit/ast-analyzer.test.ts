import { ASTAnalyzer } from '../../src/analysis/ast/analyzer';
import { FileChange } from '../../src/types';

describe('ASTAnalyzer', () => {
  it('detects console.log with accurate line numbers', () => {
    const analyzer = new ASTAnalyzer();
    const files: FileChange[] = [
      {
        filename: 'src/index.ts',
        status: 'modified',
        additions: 2,
        deletions: 0,
        changes: 2,
        patch: `@@ -10,2 +10,4 @@\n const a = 1;\n+console.log(a);\n+debugger;\n`,
      },
    ];

    const findings = analyzer.analyze(files);
    const consoleFinding = findings.find(f => f.title.includes('Console'));
    const debuggerFinding = findings.find(f => f.title.includes('Debugger'));

    expect(consoleFinding?.line).toBe(11);
    expect(debuggerFinding?.line).toBe(12);
    expect(consoleFinding?.providers).toEqual(['ast']);
  });

  it('detects empty catch blocks and unsafe any', () => {
    const analyzer = new ASTAnalyzer();
    const files: FileChange[] = [
      {
        filename: 'src/service.ts',
        status: 'modified',
        additions: 3,
        deletions: 0,
        changes: 3,
        patch: `@@ -1,1 +1,4 @@\n+async function run(): Promise<any> {\n+  try {\n+  } catch (e) {}\n+}\n`,
      },
    ];

    const findings = analyzer.analyze(files);
    const anyFinding = findings.find(f => f.title.includes('Unsafe any'));
    const catchFinding = findings.find(f => f.title.includes('Empty catch'));

    expect(anyFinding?.line).toBe(1);
    expect(catchFinding?.line).toBe(3);
  });
});
