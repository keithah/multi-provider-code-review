import {
  extractCodeSnippet,
  formatSnippet,
  detectLanguage,
  createEnhancedCommentBody,
} from '../../../src/utils/code-snippet';

describe('code-snippet', () => {
  describe('extractCodeSnippet', () => {
    const sampleCode = `function example() {
  const x = 1;
  const y = 2;
  const z = x + y;
  return z;
}`;

    it('should extract snippet with context', () => {
      const snippet = extractCodeSnippet(sampleCode, 3, 1);

      expect(snippet).not.toBeNull();
      expect(snippet!.startLine).toBe(2);
      expect(snippet!.endLine).toBe(4);
      expect(snippet!.highlightLine).toBe(3);
      expect(snippet!.lines).toEqual([
        '  const x = 1;',
        '  const y = 2;',
        '  const z = x + y;',
      ]);
    });

    it('should handle first line', () => {
      const snippet = extractCodeSnippet(sampleCode, 1, 2);

      expect(snippet).not.toBeNull();
      expect(snippet!.startLine).toBe(1);
      expect(snippet!.lines.length).toBe(3);
    });

    it('should handle last line', () => {
      const snippet = extractCodeSnippet(sampleCode, 6, 2);

      expect(snippet).not.toBeNull();
      expect(snippet!.endLine).toBe(6);
      expect(snippet!.lines.length).toBe(3);
    });

    it('should return null for invalid line', () => {
      expect(extractCodeSnippet(sampleCode, 0, 1)).toBeNull();
      expect(extractCodeSnippet(sampleCode, 100, 1)).toBeNull();
      expect(extractCodeSnippet('', 1, 1)).toBeNull();
    });
  });

  describe('formatSnippet', () => {
    it('should format with line numbers and highlight', () => {
      const snippet = {
        startLine: 10,
        endLine: 12,
        lines: ['const a = 1;', 'const b = 2;', 'const c = 3;'],
        highlightLine: 11,
      };

      const formatted = formatSnippet(snippet, 'typescript');

      expect(formatted).toContain('```typescript');
      expect(formatted).toContain('  10  const a = 1;');
      expect(formatted).toContain('  11→ const b = 2;'); // Highlighted
      expect(formatted).toContain('  12  const c = 3;');
    });

    it('should format without line numbers', () => {
      const snippet = {
        startLine: 1,
        endLine: 2,
        lines: ['line1', 'line2'],
        highlightLine: 1,
      };

      const formatted = formatSnippet(snippet, '', false);

      expect(formatted).not.toContain('1 ');
      expect(formatted).toContain('→ line1');
      expect(formatted).toContain('  line2');
    });

    it('should handle empty snippet', () => {
      const snippet = {
        startLine: 1,
        endLine: 1,
        lines: [],
        highlightLine: 1,
      };

      expect(formatSnippet(snippet)).toBe('');
    });
  });

  describe('detectLanguage', () => {
    it('should detect TypeScript', () => {
      expect(detectLanguage('src/file.ts')).toBe('typescript');
      expect(detectLanguage('component.tsx')).toBe('tsx');
    });

    it('should detect JavaScript', () => {
      expect(detectLanguage('app.js')).toBe('javascript');
      expect(detectLanguage('Component.jsx')).toBe('jsx');
    });

    it('should detect Python', () => {
      expect(detectLanguage('script.py')).toBe('python');
    });

    it('should detect other languages', () => {
      expect(detectLanguage('main.go')).toBe('go');
      expect(detectLanguage('lib.rs')).toBe('rust');
      expect(detectLanguage('App.java')).toBe('java');
      expect(detectLanguage('config.yml')).toBe('yaml');
      expect(detectLanguage('data.json')).toBe('json');
    });

    it('should return empty for unknown extension', () => {
      expect(detectLanguage('file.unknown')).toBe('');
      expect(detectLanguage('noextension')).toBe('');
    });
  });

  describe('createEnhancedCommentBody', () => {
    it('should enhance comment with snippet', () => {
      const originalBody = 'This is a finding';
      const snippet = {
        startLine: 1,
        endLine: 2,
        lines: ['const x = 1;', 'const y = 2;'],
        highlightLine: 1,
      };

      const enhanced = createEnhancedCommentBody(originalBody, snippet, 'file.ts');

      expect(enhanced).toContain('This is a finding');
      expect(enhanced).toContain('**Code Context:**');
      expect(enhanced).toContain('```typescript');
      expect(enhanced).toContain('const x = 1;');
    });

    it('should return original body if no snippet', () => {
      const originalBody = 'This is a finding';
      const enhanced = createEnhancedCommentBody(originalBody, null, 'file.ts');

      expect(enhanced).toBe(originalBody);
    });
  });
});
