import Parser from 'tree-sitter';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TypeScript = require('tree-sitter-typescript');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Python = require('tree-sitter-python');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Go = (() => { try { return require('tree-sitter-go'); } catch { return null; } })();
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Rust = (() => { try { return require('tree-sitter-rust'); } catch { return null; } })();

export type Language = 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'unknown';

export function detectLanguage(filename: string): Language {
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
  if (filename.endsWith('.py')) return 'python';
  if (filename.endsWith('.go')) return 'go';
  if (filename.endsWith('.rs')) return 'rust';
  return 'unknown';
}

export function getParser(language: Language): Parser | null {
  const parser = new Parser();
  try {
    if (language === 'typescript' || language === 'javascript') {
      parser.setLanguage(TypeScript.typescript);
      return parser;
    }
    if (language === 'python') {
      parser.setLanguage(Python);
      return parser;
    }
    if (language === 'go' && Go) {
      parser.setLanguage(Go);
      return parser;
    }
    if (language === 'rust' && Rust) {
      parser.setLanguage(Rust);
      return parser;
    }
  } catch {
    return null;
  }
  return null;
}
