import { ValidationDetector } from '../../../src/analysis/context/validation-detector';

describe('ValidationDetector', () => {
  let detector: ValidationDetector;

  beforeEach(() => {
    detector = new ValidationDetector();
  });

  describe('analyzeDefensivePatterns', () => {
    test('detects typeof checks', () => {
      const code = `
        if (typeof value !== 'string') {
          return 'invalid';
        }
      `;

      const result = detector.analyzeDefensivePatterns(code, 1);

      expect(result.validations).toContainEqual({
        type: 'type_check',
        line: 2,
        variable: 'value',
        description: "Validates value is not a string",
      });
    });

    test('detects null/undefined checks', () => {
      const code = `
        if (value === null || value === undefined) {
          throw new Error('Invalid');
        }
      `;

      const result = detector.analyzeDefensivePatterns(code, 1);

      expect(result.validations.some(v => v.type === 'null_check')).toBe(true);
    });

    test('detects error returns', () => {
      const code = `
        function encode(value: string): string {
          if (typeof value !== 'string') {
            return 'invalid';
          }
          return encodeURIComponent(value);
        }
      `;

      const result = detector.analyzeDefensivePatterns(code, 1);

      expect(result.validations.some(v => v.type === 'error_return')).toBe(true);
      expect(result.errorHandling.hasErrorReturn).toBe(true);
    });

    test('detects try-catch blocks', () => {
      const code = `
        try {
          await fs.readFile(path);
        } catch (error) {
          logger.error('Failed', error);
        }
      `;

      const result = detector.analyzeDefensivePatterns(code, 1);

      expect(result.errorHandling.hasTryCatch).toBe(true);
    });

    test('detects existence checks', () => {
      const code = `
        const value = data?.field || defaultValue;
        await fs.mkdir(dir, { recursive: true });
      `;

      const result = detector.analyzeDefensivePatterns(code, 1);

      expect(result.validations.some(v => v.type === 'existence_check')).toBe(true);
    });

    test('detects graceful degradation', () => {
      const code = `
        try {
          await operation();
        } catch (error) {
          // Graceful degradation: continue with fallback
          return fallback;
        }
      `;

      const result = detector.analyzeDefensivePatterns(code, 1);

      expect(result.errorHandling.hasGracefulDegradation).toBe(true);
    });

    test('detects range/bounds checks', () => {
      const code = `
        if (index < 0 || index >= array.length) {
          throw new Error('Index out of bounds');
        }
      `;

      const result = detector.analyzeDefensivePatterns(code, 1);

      expect(result.validations.some(v => v.type === 'range_check')).toBe(true);
    });

    test('detects locking mechanisms', () => {
      const code = `
        await this.acquireLock(key);
        try {
          // critical section
        } finally {
          this.releaseLock(key);
        }
      `;

      const result = detector.analyzeDefensivePatterns(code, 1);

      expect(result.validations.some(v => v.type === 'locking')).toBe(true);
    });

    test('detects timeout enforcement with Promise.race', () => {
      const code = `
        const result = await Promise.race([
          operation(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
      `;

      const result = detector.analyzeDefensivePatterns(code, 1);

      expect(result.validations.some(v => v.type === 'timeout_enforcement')).toBe(true);
    });

    test('detects parameter validation', () => {
      const code = `
        if (batchSize < 1 || !Number.isInteger(batchSize)) {
          throw new Error('Invalid batch size');
        }
      `;

      const result = detector.analyzeDefensivePatterns(code, 1);

      expect(result.validations.some(v => v.type === 'param_validation')).toBe(true);
    });

    test('detects intentionally unused parameters', () => {
      const code = `
        async function healthCheck(_timeoutMs: number = 5000): Promise<boolean> {
          return true;
        }
      `;

      const result = detector.analyzeDefensivePatterns(code, 1);

      expect(result.validations.some(v =>
        v.type === 'intentionally_unused' && v.variable === '_timeoutMs'
      )).toBe(true);
    });
  });

  describe('generatePromptContext', () => {
    test('generates context for defensive patterns', () => {
      const code = `
        function process(value: string): string {
          if (typeof value !== 'string') {
            return 'invalid';
          }
          if (value === null) {
            return 'null';
          }
          return value.toUpperCase();
        }
      `;

      const context = detector.analyzeDefensivePatterns(code, 1);
      const promptContext = detector.generatePromptContext(context);

      expect(promptContext).toContain('Defensive Programming Context');
      expect(promptContext).toContain('Type check');
      expect(promptContext).toContain('verify these defensive patterns');
    });

    test('returns empty string for no patterns', () => {
      const code = `
        const x = 1;
        const y = 2;
      `;

      const context = detector.analyzeDefensivePatterns(code, 1);
      const promptContext = detector.generatePromptContext(context);

      expect(promptContext).toBe('');
    });
  });

  describe('hasValidationCoverage', () => {
    test('returns true when validation exists nearby', () => {
      const code = `
        if (typeof value !== 'string') {
          return 'invalid';
        }
        const encoded = encodeURIComponent(value);
      `;

      const context = detector.analyzeDefensivePatterns(code, 1);

      // Line 5 (encodeURIComponent call) is covered by line 2 (typeof check)
      expect(detector.hasValidationCoverage(context, 5, 'value')).toBe(true);
    });

    test('returns false when no validation nearby', () => {
      const code = `
        const x = 1;
        const y = 2;
        const z = x + y;
      `;

      const context = detector.analyzeDefensivePatterns(code, 1);

      expect(detector.hasValidationCoverage(context, 3)).toBe(false);
    });
  });

  describe('real-world examples', () => {
    test('detects validation in encodeURIComponentSafe', () => {
      const code = `
        export function encodeURIComponentSafe(value: string): string {
          if (typeof value !== 'string') {
            return 'invalid';
          }

          const encoded = encodeURIComponent(value);
          const normalized = encoded.replace(/[+]/g, '_');
          return normalized;
        }
      `;

      const context = detector.analyzeDefensivePatterns(code, 1);

      // Should detect typeof check at line 3
      expect(context.validations.some(v =>
        v.type === 'type_check' && v.variable === 'value'
      )).toBe(true);

      // Should detect error return
      expect(context.errorHandling.hasErrorReturn).toBe(true);

      // Line 7 (encodeURIComponent) should have validation coverage
      expect(detector.hasValidationCoverage(context, 7, 'value')).toBe(true);
    });

    test('detects validation in deleteByPrefix', () => {
      const code = `
        async deleteByPrefix(prefix: string): Promise<number> {
          try {
            await fs.mkdir(this.baseDir, { recursive: true });
          } catch (error) {
            logger.error('Failed to create cache directory', error);
            return 0;
          }

          const files = await fs.readdir(this.baseDir);
          // ... rest of implementation
        }
      `;

      const context = detector.analyzeDefensivePatterns(code, 1);

      // Should detect try-catch
      expect(context.errorHandling.hasTryCatch).toBe(true);

      // Should detect existence check (mkdir)
      expect(context.validations.some(v => v.type === 'existence_check')).toBe(true);

      // Should detect error return
      expect(context.errorHandling.hasErrorReturn).toBe(true);
    });
  });
});
