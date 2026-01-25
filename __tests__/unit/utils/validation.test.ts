import {
  ValidationError,
  validateRequired,
  validatePositiveInteger,
  validateNonNegativeNumber,
  validateInRange,
  validateEnum,
  validateArray,
  validateNonEmptyArray,
  validateStringArray,
  validateModelId,
  validateApiKey,
  validateTimeout,
  validateFilePath,
  formatValidationError,
  validateConfig,
} from '../../../src/utils/validation';

describe('Validation Utilities', () => {
  describe('ValidationError', () => {
    it('creates error with message and field', () => {
      const error = new ValidationError('Test error', 'testField', 'Test hint');

      expect(error.message).toBe('Test error');
      expect(error.field).toBe('testField');
      expect(error.hint).toBe('Test hint');
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('validateRequired', () => {
    it('passes for non-empty string', () => {
      expect(() => validateRequired('value', 'field')).not.toThrow();
    });

    it('throws for undefined', () => {
      expect(() => validateRequired(undefined, 'field')).toThrow(ValidationError);
      expect(() => validateRequired(undefined, 'field')).toThrow('field is required');
    });

    it('throws for null', () => {
      expect(() => validateRequired(null, 'field')).toThrow(ValidationError);
    });

    it('throws for empty string', () => {
      expect(() => validateRequired('', 'field')).toThrow(ValidationError);
    });

    it('passes for number 0', () => {
      expect(() => validateRequired(0, 'field')).not.toThrow();
    });

    it('passes for boolean false', () => {
      expect(() => validateRequired(false, 'field')).not.toThrow();
    });
  });

  describe('validatePositiveInteger', () => {
    it('returns positive integer', () => {
      expect(validatePositiveInteger(5, 'field')).toBe(5);
      expect(validatePositiveInteger('10', 'field')).toBe(10);
    });

    it('throws for non-number', () => {
      expect(() => validatePositiveInteger('abc', 'field')).toThrow('field must be a number');
    });

    it('throws for decimal', () => {
      expect(() => validatePositiveInteger(5.5, 'field')).toThrow('field must be an integer');
    });

    it('throws for zero', () => {
      expect(() => validatePositiveInteger(0, 'field')).toThrow('field must be positive');
    });

    it('throws for negative', () => {
      expect(() => validatePositiveInteger(-5, 'field')).toThrow('field must be positive');
    });
  });

  describe('validateNonNegativeNumber', () => {
    it('returns non-negative number', () => {
      expect(validateNonNegativeNumber(0, 'field')).toBe(0);
      expect(validateNonNegativeNumber(5.5, 'field')).toBe(5.5);
    });

    it('throws for negative', () => {
      expect(() => validateNonNegativeNumber(-1, 'field')).toThrow('field cannot be negative');
    });

    it('throws for NaN', () => {
      expect(() => validateNonNegativeNumber(NaN, 'field')).toThrow('field must be a number');
    });
  });

  describe('validateInRange', () => {
    it('passes for value in range', () => {
      expect(() => validateInRange(5, 'field', 1, 10)).not.toThrow();
      expect(() => validateInRange(1, 'field', 1, 10)).not.toThrow();
      expect(() => validateInRange(10, 'field', 1, 10)).not.toThrow();
    });

    it('throws for value below range', () => {
      expect(() => validateInRange(0, 'field', 1, 10)).toThrow('field must be between 1 and 10');
    });

    it('throws for value above range', () => {
      expect(() => validateInRange(11, 'field', 1, 10)).toThrow('field must be between 1 and 10');
    });
  });

  describe('validateEnum', () => {
    const options = ['a', 'b', 'c'] as const;

    it('returns valid enum value', () => {
      expect(validateEnum('a', 'field', options)).toBe('a');
      expect(validateEnum('b', 'field', options)).toBe('b');
    });

    it('throws for invalid value', () => {
      expect(() => validateEnum('d', 'field', options)).toThrow('field has invalid value');
    });

    it('throws for non-string', () => {
      expect(() => validateEnum(123, 'field', options)).toThrow('field must be a string');
    });
  });

  describe('validateArray', () => {
    it('returns array', () => {
      const arr = [1, 2, 3];
      expect(validateArray(arr, 'field')).toBe(arr);
    });

    it('throws for non-array', () => {
      expect(() => validateArray('string', 'field')).toThrow('field must be an array');
      expect(() => validateArray({}, 'field')).toThrow('field must be an array');
    });
  });

  describe('validateNonEmptyArray', () => {
    it('returns non-empty array', () => {
      const arr = [1];
      expect(validateNonEmptyArray(arr, 'field')).toBe(arr);
    });

    it('throws for empty array', () => {
      expect(() => validateNonEmptyArray([], 'field')).toThrow('field cannot be empty');
    });
  });

  describe('validateStringArray', () => {
    it('returns string array', () => {
      const arr = ['a', 'b'];
      expect(validateStringArray(arr, 'field')).toBe(arr);
    });

    it('throws for array with non-string', () => {
      expect(() => validateStringArray(['a', 123], 'field')).toThrow('field[1] must be a string');
    });
  });

  describe('validateModelId', () => {
    it('passes for valid model IDs', () => {
      expect(() => validateModelId('openrouter/model')).not.toThrow();
      expect(() => validateModelId('opencode/model')).not.toThrow();
      expect(() => validateModelId('anthropic/claude')).not.toThrow();
    });

    it('warns for model ID without prefix', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation();
      validateModelId('just-a-model');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('throws for empty model ID', () => {
      expect(() => validateModelId('')).toThrow('Model ID is required');
    });
  });

  describe('validateApiKey', () => {
    it('returns valid API key', () => {
      expect(validateApiKey('sk-1234567890abcdef', 'provider')).toBe('sk-1234567890abcdef');
    });

    it('throws for empty API key', () => {
      expect(() => validateApiKey('', 'provider')).toThrow('API key for provider is required');
    });

    it('throws for short API key', () => {
      expect(() => validateApiKey('short', 'provider')).toThrow('API key for provider appears invalid');
    });

    it('throws for non-string', () => {
      expect(() => validateApiKey(123, 'provider')).toThrow('API key for provider is required');
    });
  });

  describe('validateTimeout', () => {
    it('passes for reasonable timeout', () => {
      expect(() => validateTimeout(5000)).not.toThrow();
    });

    it('throws for timeout less than 1000ms', () => {
      expect(() => validateTimeout(500)).toThrow('Timeout too short');
    });

    it('warns for very long timeout', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation();
      validateTimeout(700000);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('throws for negative timeout', () => {
      expect(() => validateTimeout(-1000)).toThrow();
    });
  });

  describe('validateFilePath', () => {
    it('returns valid file path', () => {
      expect(validateFilePath('src/test.ts')).toBe('src/test.ts');
      expect(validateFilePath('/absolute/path')).toBe('/absolute/path');
    });

    it('throws for non-string', () => {
      expect(() => validateFilePath(123)).toThrow('File path must be a string');
    });

    it('throws for empty path', () => {
      expect(() => validateFilePath('')).toThrow('File path cannot be empty');
    });

    it('throws for directory traversal', () => {
      expect(() => validateFilePath('../../../etc/passwd')).toThrow('directory traversal');
    });
  });

  describe('formatValidationError', () => {
    it('formats ValidationError with all fields', () => {
      const error = new ValidationError('Test error', 'field', 'Test hint');
      const formatted = formatValidationError(error);

      expect(formatted).toContain('❌ Test error');
      expect(formatted).toContain('(field: field)');
      expect(formatted).toContain('💡 Hint: Test hint');
    });

    it('formats ValidationError without hint', () => {
      const error = new ValidationError('Test error', 'field');
      const formatted = formatValidationError(error);

      expect(formatted).toContain('❌ Test error');
      expect(formatted).not.toContain('💡 Hint');
    });

    it('formats regular Error', () => {
      const error = new Error('Regular error');
      const formatted = formatValidationError(error);

      expect(formatted).toBe('❌ Regular error');
    });
  });

  describe('validateConfig', () => {
    it('passes for valid config', () => {
      const config = {
        providers: ['openrouter/model'],
        providerLimit: 5,
        inlineMaxComments: 10,
        budgetMaxUsd: 1.0,
        inlineMinSeverity: 'major',
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('allows empty providers array for dynamic model discovery', () => {
      const config = { providers: [] };
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('throws for non-string provider', () => {
      const config = { providers: [123] };
      expect(() => validateConfig(config)).toThrow();
    });

    it('throws for negative providerLimit', () => {
      const config = { providerLimit: -1 };
      expect(() => validateConfig(config)).toThrow();
    });

    it('throws for providerLimit out of range', () => {
      const config = { providerLimit: 150 };
      expect(() => validateConfig(config)).toThrow();
    });

    it('warns for high inlineMaxComments', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation();
      const config = { inlineMaxComments: 200 };
      validateConfig(config);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('warns for high budgetMaxUsd', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation();
      const config = { budgetMaxUsd: 150 };
      validateConfig(config);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('throws for invalid severity', () => {
      const config = { inlineMinSeverity: 'invalid' };
      expect(() => validateConfig(config)).toThrow();
    });
  });
});
