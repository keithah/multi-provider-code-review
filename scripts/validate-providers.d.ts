/**
 * Type definitions for validate-providers.js
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a single provider string
 */
export function validateProvider(provider: string): ValidationResult;

/**
 * Validate a comma-separated list of providers
 */
export function validateProviders(providersString: string): boolean;
