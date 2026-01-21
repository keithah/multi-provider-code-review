import * as fs from 'fs';
import * as path from 'path';
import { FileChange, TestCoverageHint } from '../types';

export class TestCoverageAnalyzer {
  analyze(files: FileChange[]): TestCoverageHint[] {
    const hints: TestCoverageHint[] = [];

    for (const file of files) {
      if (!this.isCodeFile(file.filename)) continue;
      if (this.isTestFile(file.filename)) continue;

      const existing = this.findTestFile(file.filename);
      if (!existing) {
        hints.push({
          file: file.filename,
          suggestedTestFile: this.suggestTestFile(file.filename),
          testPattern: this.getPattern(file.filename),
        });
      }
    }

    return hints;
  }

  private isCodeFile(filename: string): boolean {
    return ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.rb', '.java'].some(ext =>
      filename.endsWith(ext)
    );
  }

  private isTestFile(filename: string): boolean {
    const patterns = ['.test.', '.spec.', '__tests__', 'tests/', 'test_'];
    return patterns.some(pattern => filename.includes(pattern));
  }

  private findTestFile(filename: string): string | null {
    const dir = path.dirname(filename);
    const base = path.basename(filename, path.extname(filename));
    const ext = path.extname(filename);

    const candidates = [
      `${base}.test${ext}`,
      `${base}.spec${ext}`,
      `${base}_test${ext}`,
      `test_${base}${ext}`,
      path.join('__tests__', `${base}.test${ext}`),
    ];

    for (const candidate of candidates) {
      const full = path.join(dir, candidate);
      if (fs.existsSync(full)) return full;
    }

    return null;
  }

  private suggestTestFile(filename: string): string {
    const dir = path.dirname(filename);
    const base = path.basename(filename, path.extname(filename));
    const ext = path.extname(filename);

    if (ext === '.ts' || ext === '.tsx') return path.join(dir, `${base}.test.ts`);
    if (ext === '.py') return path.join(dir, `test_${base}.py`);

    return path.join(dir, `${base}.test${ext}`);
  }

  private getPattern(filename: string): string {
    const ext = path.extname(filename);
    if (ext === '.ts' || ext === '.tsx') return 'Jest: *.test.ts or __tests__/*.ts';
    if (ext === '.py') return 'pytest: test_*.py or *_test.py';
    return `*.test${ext}`;
  }
}
