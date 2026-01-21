export type Language = 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'unknown';

export function detectLanguage(filename: string): Language {
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
  if (filename.endsWith('.py')) return 'python';
  if (filename.endsWith('.go')) return 'go';
  if (filename.endsWith('.rs')) return 'rust';
  return 'unknown';
}

export function getParser(language: Language): any | null {
  const Parser = loadModule('tree-sitter');
  if (!Parser) return null;

  const parser = new Parser();
  try {
    if (language === 'typescript' || language === 'javascript') {
      const ts = loadModule('tree-sitter-typescript');
      if (!ts?.typescript) return null;
      parser.setLanguage(ts.typescript);
      return parser;
    }
    if (language === 'python') {
      const py = loadModule('tree-sitter-python');
      if (!py) return null;
      parser.setLanguage(py);
      return parser;
    }
    if (language === 'go') {
      const go = loadModule('tree-sitter-go');
      if (!go) return null;
      parser.setLanguage(go);
      return parser;
    }
    if (language === 'rust') {
      const rust = loadModule('tree-sitter-rust');
      if (!rust) return null;
      parser.setLanguage(rust);
      return parser;
    }
  } catch {
    return null;
  }

  return null;
}

function loadModule(name: string): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(name);
  } catch {
    return null;
  }
}
