import { clampPercentage, validateSeverityWithSuggestion, levenshteinDistance } from '../../../src/config/validators';
import { ValidationError } from '../../../src/utils/validation';
import { logger } from '../../../src/utils/logger';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

describe('validators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('levenshteinDistance', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshteinDistance('major', 'major')).toBe(0);
    });

    it('returns 1 for single character difference', () => {
      expect(levenshteinDistance('major', 'majr')).toBe(1);
    });

    it('returns 1 for transposition-like typo', () => {
      expect(levenshteinDistance('critical', 'critcal')).toBe(1);
    });

    it('returns correct distance for completely different strings', () => {
      expect(levenshteinDistance('abc', 'xyz')).toBe(3);
    });

    it('handles empty strings', () => {
      expect(levenshteinDistance('', 'abc')).toBe(3);
      expect(levenshteinDistance('abc', '')).toBe(3);
      expect(levenshteinDistance('', '')).toBe(0);
    });
  });

  describe('clampPercentage', () => {
    it('returns valid values unchanged without warning', () => {
      expect(clampPercentage(50, 'test')).toBe(50);
      expect(clampPercentage(0, 'test')).toBe(0);
      expect(clampPercentage(100, 'test')).toBe(100);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('clamps negative values to 0 with warning', () => {
      expect(clampPercentage(-10, 'consensus')).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('consensus')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('-10')
      );
    });

    it('clamps values over 100 to 100 with warning', () => {
      expect(clampPercentage(150, 'threshold')).toBe(100);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('150')
      );
    });

    it('handles NaN with warning and returns 50', () => {
      expect(clampPercentage(NaN, 'test')).toBe(50);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid')
      );
    });

    it('handles Infinity with warning', () => {
      expect(clampPercentage(Infinity, 'test')).toBe(100);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('validateSeverityWithSuggestion', () => {
    it('returns valid severity values unchanged', () => {
      expect(validateSeverityWithSuggestion('critical', 'field')).toBe('critical');
      expect(validateSeverityWithSuggestion('major', 'field')).toBe('major');
      expect(validateSeverityWithSuggestion('minor', 'field')).toBe('minor');
    });

    it('is case-insensitive', () => {
      expect(validateSeverityWithSuggestion('MAJOR', 'field')).toBe('major');
      expect(validateSeverityWithSuggestion('Critical', 'field')).toBe('critical');
    });

    it('throws ValidationError with typo suggestion for close matches', () => {
      expect(() => validateSeverityWithSuggestion('majr', 'minSeverity'))
        .toThrow(ValidationError);

      try {
        validateSeverityWithSuggestion('majr', 'minSeverity');
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect((e as ValidationError).hint).toContain('major');
      }
    });

    it('throws ValidationError with typo suggestion for critcal', () => {
      try {
        validateSeverityWithSuggestion('critcal', 'field');
      } catch (e) {
        expect((e as ValidationError).hint).toContain('critical');
      }
    });

    it('throws ValidationError with valid values list for distant strings', () => {
      try {
        validateSeverityWithSuggestion('xyz', 'field');
      } catch (e) {
        expect((e as ValidationError).hint).toContain('Valid values:');
        expect((e as ValidationError).hint).toContain('critical');
        expect((e as ValidationError).hint).toContain('major');
        expect((e as ValidationError).hint).toContain('minor');
      }
    });

    it('throws for non-string input', () => {
      expect(() => validateSeverityWithSuggestion(123 as unknown as string, 'field'))
        .toThrow(ValidationError);
    });
  });
});
