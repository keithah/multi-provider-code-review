import { FileChange, Finding } from '../../types';
import { detectPatternFindings } from './patterns';
import { detectLanguage, getParser, Language } from './parsers';
import { mapAddedLines } from '../../utils/diff';

export class ASTAnalyzer {
  analyze(files: FileChange[]): Finding[] {
    const findings: Finding[] = [];

    for (const file of files) {
      if (this.isTestFile(file.filename)) {
        continue;
      }
      const language = detectLanguage(file.filename);
      const addedLines = mapAddedLines(file.patch);

      findings.push(...detectPatternFindings(file.filename, addedLines));

      if (language !== 'unknown') {
        findings.push(...this.runLanguageChecks(file.filename, language, addedLines));
      }

      findings.push(...this.runHeuristics(file.filename, addedLines));
    }

    return findings;
  }

  private runLanguageChecks(
    filename: string,
    language: Language,
    addedLines: ReturnType<typeof mapAddedLines>
  ): Finding[] {
    const findings: Finding[] = [];

    const code = addedLines.map(l => l.content).join('\n');
    if (!code.trim()) return findings;

    const parser = getParser(language);
    if (!parser) {
      return this.runHeuristics(filename, addedLines);
    }

    const tree = parser.parse(code);
    const lineLookup = addedLines.map(l => l.line);

    const stack = [tree.rootNode];
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) continue;

      if (language !== 'python') {
        if (node.type === 'call_expression') {
          const fnNode = node.childForFieldName('function');
          if (fnNode && fnNode.text === 'console.log') {
            const row = node.startPosition.row;
            const line = lineLookup[row] ?? row + 1;
            findings.push({
              file: filename,
              line,
              severity: 'minor',
              title: 'Console logging left in code',
              message: 'Remove debug logging before merging.',
              provider: 'ast',
              providers: ['ast'],
            });
          }
        }

        if (node.type === 'debugger_statement') {
          const row = node.startPosition.row;
          const line = lineLookup[row] ?? row + 1;
          findings.push({
            file: filename,
            line,
            severity: 'major',
            title: 'Debugger statement',
            message: 'Debugger statements should be removed.',
            provider: 'ast',
            providers: ['ast'],
          });
        }

        if (language === 'typescript' && node.type === 'predefined_type' && node.text === 'any') {
          const row = node.startPosition.row;
          const line = lineLookup[row] ?? row + 1;
          findings.push({
            file: filename,
            line,
            severity: 'major',
            title: 'Unsafe any type',
            message: 'Avoid using `any`; prefer specific types.',
            provider: 'ast',
            providers: ['ast'],
          });
        }

        if (node.type === 'catch_clause') {
          const body = node.childForFieldName('body');
          if (body && body.namedChildCount === 0) {
            const row = node.startPosition.row;
            const line = lineLookup[row] ?? row + 1;
            findings.push({
              file: filename,
              line,
              severity: 'major',
              title: 'Empty catch block',
              message: 'Handle or log errors in catch blocks.',
              provider: 'ast',
              providers: ['ast'],
            });
          }
        }
      } else {
        if (node.type === 'call' && node.child(0)?.text === 'print') {
          const row = node.startPosition.row;
          const line = lineLookup[row] ?? row + 1;
          findings.push({
            file: filename,
            line,
            severity: 'minor',
            title: 'Debug print statement',
            message: 'Remove debug print statements before merging.',
            provider: 'ast',
            providers: ['ast'],
          });
        }
      }

      for (const child of node.children) {
        stack.push(child);
      }
    }

    return findings;
  }

  private isTestFile(filename: string): boolean {
    const lower = filename.toLowerCase();
    return lower.includes('__tests__') || lower.includes('/tests/') || lower.endsWith('.test.ts') || lower.endsWith('.test.js') || lower.endsWith('.spec.ts') || lower.endsWith('.spec.js');
  }

  private runHeuristics(
    filename: string,
    addedLines: ReturnType<typeof mapAddedLines>
  ): Finding[] {
    const findings: Finding[] = [];

    for (const { line, content } of addedLines) {
      if ((/\bPromise<any>\b/.test(content) && !content.includes('/Promise<any>/')) || (/:\\s*any\\b/.test(content) && !content.includes('/:\\s*any\\b/'))) {
        findings.push({
          file: filename,
          line,
          severity: 'major',
          title: 'Unsafe any type',
          message: 'Avoid using `any`; prefer specific types.',
          provider: 'ast',
          providers: ['ast'],
        });
      }

      if (/catch\s*\([^)]*\)\s*{\s*}/.test(content)) {
        findings.push({
          file: filename,
          line,
          severity: 'major',
          title: 'Empty catch block',
          message: 'Handle or log errors in catch blocks.',
          provider: 'ast',
          providers: ['ast'],
        });
      }
    }

    return findings;
  }
}
