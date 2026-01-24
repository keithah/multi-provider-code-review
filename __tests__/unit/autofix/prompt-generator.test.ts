import { PromptGenerator } from '../../../src/autofix/prompt-generator';
import { Finding } from '../../../src/types';

describe('PromptGenerator', () => {
  let generator: PromptGenerator;

  beforeEach(() => {
    generator = new PromptGenerator();
  });

  describe('generate', () => {
    it('should generate fix prompts for findings', () => {
      const findings: Finding[] = [
        {
          file: 'src/test.ts',
          line: 10,
          severity: 'major',
          title: 'Null pointer',
          message: 'Variable could be null',
          suggestion: 'Add null check',
        },
      ];

      const result = generator.generate(findings);

      expect(result.prompts).toHaveLength(1);
      expect(result.prompts[0].fixPrompt).toContain('Add null check');
      expect(result.prompts[0].file).toContain('test.ts');
      expect(result.totalFindings).toBe(1);
      expect(result.promptsGenerated).toBe(1);
    });

    it('should handle findings without suggestions', () => {
      const findings: Finding[] = [
        {
          file: 'src/test.ts',
          line: 10,
          severity: 'major',
          title: 'Issue',
          message: 'Problem found',
        },
      ];

      const result = generator.generate(findings);

      expect(result.prompts).toHaveLength(0); // No suggestion = no prompt
      expect(result.totalFindings).toBe(1);
      expect(result.promptsGenerated).toBe(0);
    });

    it('should format prompts for Cursor IDE', () => {
      const findings: Finding[] = [{
        file: 'test.ts',
        line: 1,
        severity: 'major',
        title: 'Test',
        message: 'Test',
        suggestion: 'Fix it',
      }];
      const result = generator.generate(findings, 'cursor');

      expect(result).toBeDefined();
      expect(result.format).toBe('cursor');
    });

    it('should format prompts for Copilot', () => {
      const findings: Finding[] = [{
        file: 'test.ts',
        line: 1,
        severity: 'major',
        title: 'Test',
        message: 'Test',
        suggestion: 'Fix it',
      }];
      const result = generator.generate(findings, 'copilot');

      expect(result).toBeDefined();
      expect(result.format).toBe('copilot');
    });
  });
});
