import { PromptGenerator } from '../../../src/autofix/prompt-generator';
import { Finding } from '../../../src/types';

describe('PromptGenerator', () => {
  let generator: PromptGenerator;

  beforeEach(() => {
    generator = new PromptGenerator();
  });

  describe('generatePrompts', () => {
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

      const prompts = generator.generatePrompts(findings);

      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain('Add null check');
      expect(prompts[0]).toContain('test.ts');
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

      const prompts = generator.generatePrompts(findings);

      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain('Problem found');
    });

    it('should format prompts for Cursor IDE', () => {
      const findings: Finding[] = [{} as any];
      const prompts = generator.generatePrompts(findings, 'cursor');

      expect(prompts).toBeDefined();
    });

    it('should format prompts for Copilot', () => {
      const findings: Finding[] = [{} as any];
      const prompts = generator.generatePrompts(findings, 'copilot');

      expect(prompts).toBeDefined();
    });
  });
});
