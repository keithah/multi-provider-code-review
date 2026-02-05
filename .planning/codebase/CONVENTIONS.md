# Coding Conventions

**Analysis Date:** 2026-02-04

## Naming Patterns

**Files:**
- Kebab-case for filenames: `finding-filter.ts`, `circuit-breaker.ts`, `graph-builder.ts`
- Test files: `*.test.ts` (colocated with source when possible)
- Index files use `index.ts` in directories to export modules

**Functions:**
- camelCase for function names
- Descriptive names reflecting purpose: `filterHealthyProviders()`, `validatePatterns()`, `determineIntensity()`
- Private methods prefixed with underscore: `_validateSinglePattern()`, `_getFilterReason()`
- Error handler functions: `withRetry()`, `createQueue()`

**Variables:**
- camelCase for all variable declarations
- Constants in UPPER_SNAKE_CASE: `MAX_PATTERN_LENGTH`, `MAX_COMPLEXITY_SCORE`, `CURRENT_LEVEL`
- Single-letter variables limited to loop indices: `i`, `idx`
- Descriptive variable names preferred: `healthyProviders`, `matchedPaths`, `providerResults`

**Types:**
- PascalCase for interfaces and types: `ReviewConfig`, `FileChange`, `PathPattern`, `IntensityResult`
- Suffix interfaces with descriptive nouns: `FindingFilter`, `ReviewResult`, `ProviderResult`
- Generic type parameters: `T`, `K`, `V` (single letters acceptable for generics)
- Discriminated union types: `status: 'success' | 'error' | 'timeout'`

## Code Style

**Formatting:**
- Tool: Prettier (configured in `.prettierrc`)
- Single quotes for strings: `'single quotes'` (not double quotes)
- Trailing commas in multiline arrays/objects: enabled (es5 format)
- Semicolons: required at statement ends
- Line length: no enforced limit (Prettier handles formatting)

**Linting:**
- Tool: ESLint (configured in `.eslintrc.cjs`)
- Parser: `@typescript-eslint/parser`
- Base rules: `eslint:recommended` + `plugin:@typescript-eslint/recommended`
- Custom rules:
  - `@typescript-eslint/no-explicit-any`: warn (discourages `any` type)
  - `@typescript-eslint/no-unused-vars`: error with patterns for ignored variables prefixed with `_`
- Run with: `npm run lint`
- Format with: `npm run format`

**Indentation:**
- 2 spaces (Prettier default)
- No tabs

## Import Organization

**Order:**
1. Built-in Node modules: `import * as path from 'path'; import * as fs from 'fs/promises';`
2. External packages: `import { ReviewConfig } from '../types'; import { logger } from '../utils/logger';`
3. Relative imports from same directory: `import { FindingFilter } from './finding-filter';`
4. Relative imports from parent directories: `import { ReviewOrchestrator } from '../../core/orchestrator';`

**Path Aliases:**
- Not used (direct relative paths preferred)
- Paths use relative imports consistently: `../../src/types` for crossing directory boundaries

**Grouping:**
- Imports grouped by source (built-in → external → relative)
- No blank lines within groups
- Single blank line between groups
- Duplicate imports merged on single line when possible

## Error Handling

**Patterns:**
- Custom error classes extend Error: `class ValidationError extends Error`
- Error metadata attached to error instances: `error.field`, `error.hint`, `error.code`
- Errors caught with `as Error` pattern: `const err = error as Error;`
- Validation errors include field name and helpful hint

**Try-Catch Strategy:**
- Try-catch used for async operations in Promise chains
- Error logging happens in catch blocks with `logger.error()`
- Re-throw only if error needs to propagate up the stack
- Otherwise handle gracefully and log

**Example Pattern:**
```typescript
try {
  const result = await provider.review(prompt, timeoutMs);
  return result;
} catch (error) {
  const err = error as Error;
  logger.error(`Provider ${provider.name} failed: ${err.message}`);
  // Handle or return fallback
}
```

## Logging

**Framework:** Custom logger in `src/utils/logger.ts`

**Levels:**
- `debug`: Detailed execution flow, cache hits, pattern matching details
- `info`: Important milestones, provider health checks, filter statistics
- `warn`: Recoverable issues, timeouts, deprecated features
- `error`: Failures requiring attention, health check failures

**Patterns:**
- Use `logger.debug()` for trace-level details (loops, conditional branches)
- Use `logger.info()` for user-relevant events (provider count, cache hit, duration)
- Use `logger.warn()` for unexpected but recoverable issues (timeout, retry)
- Use `logger.error()` for failures that need investigation (provider down, validation failure)
- Attach metadata as second argument: `logger.info('message', { duration, cost, provider: name })`

**Environment:**
- Control level with `LOG_LEVEL` environment variable: `debug | info | warn | error` (default: `info`)
- Example: `LOG_LEVEL=debug npm run test`

## Comments

**When to Comment:**
- Document public class/function with JSDoc blocks
- Explain non-obvious algorithm or security concern
- NOTE: Avoid obvious comments like `// increment i` — code should be self-documenting
- Use for architectural decisions or performance considerations

**JSDoc/TSDoc:**
- Functions documented with `/** ... */` block comments
- @param for parameters: `@param timeoutMs - Maximum time in milliseconds`
- @returns for return values: `@returns Promise<boolean> - true if healthy`
- @throws for exceptions: `@throws ValidationError if pattern is invalid`

**Example:**
```typescript
/**
 * Validate all patterns for security and correctness
 * Throws if any pattern is invalid (length > 500 chars or complexity > 50)
 * See docs/SECURITY_PATTERNS.md for validation rationale
 */
private validatePatterns(): void {
  // ...
}
```

## Function Design

**Size:**
- Keep functions under 50 lines when possible
- Complex logic broken into private helper methods
- Large functions (1000 lines): `orchestrator.ts`, `graph-builder.ts`, `finding-filter.ts` indicate need for refactoring or are complex domain logic

**Parameters:**
- Maximum 3 parameters (use object destructuring for more)
- Use configuration objects for optional parameters: `{ enabled: boolean, patterns: PathPattern[] }`
- Object parameters destructured at function signature

**Return Values:**
- Return objects for multiple values: `{ findings, stats }` instead of tuple
- Use discriminated unions for variant results: `'filter' | 'downgrade' | 'keep'`
- Return `void` only when function has side effects only (logging, mutation)

## Module Design

**Exports:**
- Export classes and interfaces from same file
- Export utility functions from utility modules
- Private members not exported (use `private` keyword)
- Barrel exports in `index.ts`: re-export from all files in directory

**Barrel Files:**
- Pattern: `export * from './file1'; export * from './file2';`
- Used in: `src/types/index.ts`, `src/providers/index.ts`, `src/output/index.ts`
- Location: `/index.ts` files in module directories

**Class Design:**
- Constructor accepts configuration object: `constructor(config: PathMatcherConfig)`
- Instance methods are public API
- Helper/internal methods marked `private`
- Static validation methods: `Provider.validate(name: string): boolean`

## Type Safety

**TypeScript Config (`tsconfig.json`):**
- `strict: true` — enables all strict checking
- `noImplicitReturns: true` — functions must explicitly return
- `noFallthroughCasesInSwitch: true` — switch cases must have break/return
- `target: ES2022` — modern JavaScript features available

**Patterns:**
- Use discriminated unions for variant types: `status: 'success' | 'error'` not `{ success?: boolean, error?: Error }`
- Use interfaces for object shapes, types for unions/tuples
- Generic constraints: `<T extends string>` to restrict type parameters
- Avoid `any` — use `unknown` and narrow with type guards

## Async/Promise Patterns

**Async Functions:**
- Use `async/await` (not raw Promises)
- Return type explicitly typed: `async function foo(): Promise<Result>`
- Error handling in try-catch blocks

**Parallel Execution:**
- Use `createQueue()` utility from `src/utils/parallel.ts` for bounded concurrency
- Example: `const queue = createQueue(5); queue.add(async () => { ... });`
- Wait for completion: `await queue.onIdle();`

**Timeout Handling:**
- Timeout errors have specific message: `'Health check timed out after'` or similar
- Check timeout with `error.message.includes('timeout')`

---

*Convention analysis: 2026-02-04*
