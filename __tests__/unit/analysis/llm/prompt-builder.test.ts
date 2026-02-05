import { PromptBuilder } from '../../../../src/analysis/llm/prompt-builder';
import { PRContext } from '../../../../src/types';
import { DEFAULT_CONFIG } from '../../../../src/config/defaults';

describe('PromptBuilder', () => {
  const mockPR: PRContext = {
    number: 123,
    title: 'Test PR',
    body: 'Test description',
    author: 'test-user',
    draft: false,
    labels: [],
    files: [
      {
        filename: 'src/test.ts',
        status: 'modified',
        additions: 10,
        deletions: 5,
        changes: 15,
      },
    ],
    diff: 'diff --git a/src/test.ts b/src/test.ts\n@@ -1,5 +1,5 @@\n-old line\n+new line\n',
    additions: 10,
    deletions: 5,
    baseSha: 'abc123',
    headSha: 'def456',
  };

  describe('build()', () => {
    it('includes suggestion field in JSON schema', () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG);
      const prompt = builder.build(mockPR);

      expect(prompt).toContain('suggestion');
      expect(prompt).toContain('Return JSON: [{file, line, severity, title, message, suggestion}]');
    });

    it('includes fixable issue type guidance', () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG);
      const prompt = builder.build(mockPR);

      expect(prompt).toContain('SUGGESTION FIELD');
      expect(prompt).toContain('Fixable:');
      expect(prompt).toContain('NOT fixable:');
    });

    it('includes example JSON with suggestion field', () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG);
      const prompt = builder.build(mockPR);

      expect(prompt).toContain('"suggestion":');
    });

    it('specifies fixable issue types', () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG);
      const prompt = builder.build(mockPR);

      expect(prompt).toContain('null reference');
      expect(prompt).toContain('type error');
      expect(prompt).toContain('off-by-one');
      expect(prompt).toContain('missing null check');
      expect(prompt).toContain('resource leak');
    });

    it('specifies non-fixable issue types', () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG);
      const prompt = builder.build(mockPR);

      expect(prompt).toContain('architectural issues');
      expect(prompt).toContain('design suggestions');
      expect(prompt).toContain('unclear requirements');
    });

    it('includes instructions that suggestion must be exact replacement code', () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG);
      const prompt = builder.build(mockPR);

      expect(prompt).toContain('EXACT replacement code');
      expect(prompt).toContain('Include ONLY the fixed code');
    });

    it('marks suggestion field as optional', () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG);
      const prompt = builder.build(mockPR);

      expect(prompt).toContain('SUGGESTION FIELD (optional)');
      expect(prompt).toContain('Only include "suggestion" for FIXABLE issues');
    });
  });

  describe('token-aware suggestion instructions', () => {
    it('includes suggestion instructions for small diffs', () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG);
      const smallDiff = 'diff --git a/test.ts b/test.ts\n+const x = 1;';
      const smallPR = { ...mockPR, diff: smallDiff };

      const prompt = builder.build(smallPR);

      expect(prompt).toContain('SUGGESTION FIELD');
      expect(prompt).toContain('suggestion}]');
    });

    it('excludes suggestion instructions for large diffs', () => {
      const builder = new PromptBuilder(DEFAULT_CONFIG);
      // Generate a diff that exceeds 50k tokens (~200k characters)
      const largeDiff = 'diff --git a/test.ts b/test.ts\n' + '+const x = 1;\n'.repeat(60000);
      const largePR = { ...mockPR, diff: largeDiff };

      const prompt = builder.build(largePR);

      expect(prompt).not.toContain('SUGGESTION FIELD');
      // Should have original schema without suggestion
      expect(prompt).toContain('Return JSON: [{file, line, severity, title, message}]');
    });
  });
});
