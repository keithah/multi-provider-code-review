#!/usr/bin/env node
/**
 * Provider Validation Script
 * Validates provider strings for GitHub Actions workflow
 *
 * Usage: node scripts/validate-providers.js "provider1,provider2,..."
 * Exit code: 0 on success, 1 on failure
 */

// Pattern ensures:
// - Starts with valid provider name
// - Followed by slash
// - Model/vendor path with no consecutive slashes or empty segments
// - Allows alphanumeric, dots, colons, hyphens, and slashes
const PROVIDER_PATTERN = /^(openrouter|opencode|openai|anthropic|cohere|mistral|groq)\/[A-Za-z0-9._:\-]+(?:\/[A-Za-z0-9._:\-]+)*$/;

const EXAMPLES = [
  'openrouter/google/gemini-2.0-flash-exp:free',
  'openrouter/mistralai/devstral-2512:free',
  'opencode/gpt-4:free',
  'openai/gpt-4',
  'anthropic/claude-3-5-sonnet',
];

/**
 * Validate a single provider string
 */
function validateProvider(provider) {
  const trimmed = provider.trim();

  if (trimmed === '') {
    return {
      valid: false,
      error: 'Provider string is empty'
    };
  }

  if (!PROVIDER_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: `Invalid provider format: "${trimmed}"\n` +
             `Expected format: provider/model or provider/vendor/model[:tag]\n` +
             `Supported providers: openrouter, opencode, openai, anthropic, cohere, mistral, groq\n` +
             `Examples:\n${EXAMPLES.map(e => `  - ${e}`).join('\n')}`
    };
  }

  return { valid: true };
}

/**
 * Validate a comma-separated list of providers
 */
function validateProviders(providersString) {
  if (!providersString || providersString.trim() === '') {
    console.log('✅ No providers specified (will use dynamic discovery)');
    return true;
  }

  const providers = providersString.split(',');
  const errors = [];

  for (const provider of providers) {
    const result = validateProvider(provider);
    if (!result.valid) {
      errors.push(result.error);
    }
  }

  if (errors.length > 0) {
    console.error('❌ Provider validation failed:\n');
    errors.forEach((error, index) => {
      console.error(`Error ${index + 1}:`);
      console.error(error);
      console.error('');
    });
    return false;
  }

  console.log(`✅ All ${providers.length} providers validated successfully`);
  providers.forEach(p => console.log(`  - ${p.trim()}`));
  return true;
}

// Main execution
if (require.main === module) {
  const providersString = process.argv[2] || process.env.REVIEW_PROVIDERS || '';

  const success = validateProviders(providersString);
  process.exit(success ? 0 : 1);
}

module.exports = { validateProvider, validateProviders };
