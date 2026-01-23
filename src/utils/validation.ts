/**
 * Validation utilities with helpful error messages
 */

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly hint?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateRequired(value: unknown, field: string): void {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(
      `${field} is required`,
      field,
      `Please provide a value for ${field}`
    );
  }
}

export function validatePositiveInteger(value: unknown, field: string): number {
  const num = Number(value);

  if (isNaN(num)) {
    throw new ValidationError(
      `${field} must be a number`,
      field,
      `Received: ${JSON.stringify(value)}. Expected: positive integer`
    );
  }

  if (!Number.isInteger(num)) {
    throw new ValidationError(
      `${field} must be an integer`,
      field,
      `Received: ${value}. Decimals are not allowed`
    );
  }

  if (num <= 0) {
    throw new ValidationError(
      `${field} must be positive`,
      field,
      `Received: ${num}. Expected: value > 0`
    );
  }

  return num;
}

export function validateNonNegativeNumber(value: unknown, field: string): number {
  const num = Number(value);

  if (isNaN(num)) {
    throw new ValidationError(
      `${field} must be a number`,
      field,
      `Received: ${JSON.stringify(value)}. Expected: non-negative number`
    );
  }

  if (num < 0) {
    throw new ValidationError(
      `${field} cannot be negative`,
      field,
      `Received: ${num}. Expected: value >= 0`
    );
  }

  return num;
}

export function validateInRange(
  value: number,
  field: string,
  min: number,
  max: number
): void {
  if (value < min || value > max) {
    throw new ValidationError(
      `${field} must be between ${min} and ${max}`,
      field,
      `Received: ${value}. Valid range: [${min}, ${max}]`
    );
  }
}

export function validateEnum<T extends string>(
  value: unknown,
  field: string,
  allowedValues: readonly T[]
): T {
  if (typeof value !== 'string') {
    throw new ValidationError(
      `${field} must be a string`,
      field,
      `Received type: ${typeof value}. Expected one of: ${allowedValues.join(', ')}`
    );
  }

  if (!allowedValues.includes(value as T)) {
    throw new ValidationError(
      `${field} has invalid value`,
      field,
      `Received: "${value}". Expected one of: ${allowedValues.join(', ')}`
    );
  }

  return value as T;
}

export function validateArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(
      `${field} must be an array`,
      field,
      `Received type: ${typeof value}. Expected: array`
    );
  }

  return value;
}

export function validateNonEmptyArray(value: unknown, field: string): unknown[] {
  const arr = validateArray(value, field);

  if (arr.length === 0) {
    throw new ValidationError(
      `${field} cannot be empty`,
      field,
      'At least one item is required'
    );
  }

  return arr;
}

export function validateStringArray(value: unknown, field: string): string[] {
  const arr = validateArray(value, field);

  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== 'string') {
      throw new ValidationError(
        `${field}[${i}] must be a string`,
        field,
        `Received type: ${typeof arr[i]} at index ${i}`
      );
    }
  }

  return arr as string[];
}

export function validateModelId(modelId: string): void {
  if (!modelId || typeof modelId !== 'string') {
    throw new ValidationError(
      'Model ID is required',
      'modelId',
      'Model ID must be a non-empty string'
    );
  }

  // Check for common provider prefixes
  const validPrefixes = ['openrouter/', 'opencode/', 'anthropic/', 'openai/'];
  const hasValidPrefix = validPrefixes.some(prefix => modelId.startsWith(prefix));

  if (!hasValidPrefix && !modelId.includes('/')) {
    console.warn(
      `Model ID "${modelId}" doesn't have a recognized provider prefix. ` +
      `Consider using: ${validPrefixes.map(p => p + 'model-name').join(', ')}`
    );
  }
}

export function validateApiKey(apiKey: unknown, provider: string): string {
  if (typeof apiKey !== 'string' || apiKey.trim() === '') {
    throw new ValidationError(
      `API key for ${provider} is required`,
      'apiKey',
      `Set the ${provider.toUpperCase()}_API_KEY environment variable`
    );
  }

  if (apiKey.length < 10) {
    throw new ValidationError(
      `API key for ${provider} appears invalid`,
      'apiKey',
      'API keys are typically longer than 10 characters. Please check your key.'
    );
  }

  return apiKey;
}

export function validateTimeout(timeoutMs: number): void {
  validatePositiveInteger(timeoutMs, 'timeout');

  if (timeoutMs < 1000) {
    throw new ValidationError(
      'Timeout too short',
      'timeout',
      `${timeoutMs}ms is too short. Minimum recommended: 1000ms (1 second)`
    );
  }

  if (timeoutMs > 600000) {
    console.warn(
      `Timeout of ${timeoutMs}ms (${Math.round(timeoutMs / 1000)}s) is very long. ` +
      'Consider using a shorter timeout to avoid blocking.'
    );
  }
}

export function validateFilePath(filePath: unknown): string {
  if (typeof filePath !== 'string') {
    throw new ValidationError(
      'File path must be a string',
      'filePath',
      `Received type: ${typeof filePath}`
    );
  }

  if (filePath.trim() === '') {
    throw new ValidationError(
      'File path cannot be empty',
      'filePath'
    );
  }

  // Check for potential security issues
  if (filePath.includes('..')) {
    throw new ValidationError(
      'File path contains directory traversal',
      'filePath',
      `Path "${filePath}" contains ".." which may be a security risk`
    );
  }

  return filePath;
}

/**
 * Format validation error with helpful context
 */
export function formatValidationError(error: ValidationError | Error): string {
  if (error instanceof ValidationError) {
    let message = `❌ ${error.message}`;

    if (error.field) {
      message += ` (field: ${error.field})`;
    }

    if (error.hint) {
      message += `\n💡 Hint: ${error.hint}`;
    }

    return message;
  }

  return `❌ ${error.message}`;
}

/**
 * Validate configuration object
 */
export function validateConfig(config: Record<string, unknown>): void {
  // Validate providers
  if (config.providers) {
    const providers = validateNonEmptyArray(config.providers, 'providers');
    validateStringArray(providers, 'providers');

    providers.forEach((p: unknown) => {
      if (typeof p === 'string') {
        validateModelId(p);
      }
    });
  }

  // Validate numeric bounds
  if (config.providerLimit !== undefined && config.providerLimit !== null) {
    const limit = validateNonNegativeNumber(config.providerLimit, 'providerLimit');
    if (limit > 0) {
      validateInRange(limit, 'providerLimit', 1, 100);
    }
  }

  if (config.inlineMaxComments !== undefined) {
    const maxComments = validateNonNegativeNumber(config.inlineMaxComments, 'inlineMaxComments');
    if (maxComments > 100) {
      console.warn(
        `inlineMaxComments is set to ${maxComments}. ` +
        'Very high values may cause rate limiting on GitHub API.'
      );
    }
  }

  if (config.budgetMaxUsd !== undefined) {
    const budget = validateNonNegativeNumber(config.budgetMaxUsd, 'budgetMaxUsd');
    if (budget > 100) {
      console.warn(
        `budgetMaxUsd is set to $${budget}. ` +
        'This is unusually high. Make sure this is intentional.'
      );
    }
  }

  // Validate severity
  if (config.inlineMinSeverity) {
    validateEnum(
      config.inlineMinSeverity,
      'inlineMinSeverity',
      ['critical', 'major', 'minor'] as const
    );
  }
}
