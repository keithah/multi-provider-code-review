import { PRContext, ReviewConfig, ReviewIntensity } from '../../types';
import { trimDiff } from '../../utils/diff';
import { checkContextWindowFit, ContextFitCheck, estimateTokensConservative } from '../../utils/token-estimation';
import { logger } from '../../utils/logger';
import { ValidationDetector } from '../context/validation-detector';

export class PromptBuilder {
  private readonly validationDetector: ValidationDetector;

  constructor(
    private readonly config: ReviewConfig,
    private readonly intensity: ReviewIntensity = 'standard'
  ) {
    // Validate intensity parameter
    const validIntensities: ReviewIntensity[] = ['light', 'standard', 'thorough'];
    if (!validIntensities.includes(intensity)) {
      throw new Error(`Invalid intensity: ${intensity}. Must be one of: ${validIntensities.join(', ')}`);
    }
    this.validationDetector = new ValidationDetector();
  }

  build(pr: PRContext): string {
    // Validate PR context
    if (!pr || typeof pr !== 'object') {
      throw new Error('Invalid PR context: must be a valid PRContext object');
    }
    if (pr.diff === undefined || pr.diff === null || typeof pr.diff !== 'string') {
      throw new Error('Invalid PR context: diff must be a string (can be empty)');
    }
    if (!Array.isArray(pr.files)) {
      throw new Error('Invalid PR context: files must be an array');
    }

    const diff = trimDiff(pr.diff, this.config.diffMaxBytes);

    // Extract which files are actually in the trimmed diff to avoid false positives
    const filesInDiff = new Set<string>();
    const diffGitPattern = /^diff --git a\/(.+?) b\/(.+?)$/gm;
    let match;
    while ((match = diffGitPattern.exec(diff)) !== null) {
      filesInDiff.add(match[2]); // Use the "b/" path (destination)
    }

    // Filter file list to only show files that are in the diff
    const includedFiles = pr.files.filter(f => filesInDiff.has(f.filename));
    const excludedCount = pr.files.length - includedFiles.length;

    const fileList = [
      ...includedFiles.map(f => `- ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`),
    ];

    if (excludedCount > 0) {
      fileList.push(`  (${excludedCount} additional file(s) truncated)`);
    }

    const _depth = this.config.intensityPromptDepth?.[this.intensity] ?? 'standard';

    const instructions = [
      `You are a code reviewer. ONLY report actual bugs - code that will crash, lose data, or have security vulnerabilities.`,
      '',
      'CRITICAL RULES (READ CAREFULLY):',
      '',
      '1. SKIP these file types entirely - DO NOT review them:',
      '   • Test files: *.test.ts, *.spec.ts, __tests__/*, *test*, *spec*',
      '   • Workflow/CI: .github/workflows/*, .github/actions/*, *.yml in .github/',
      '   • Config: *.json, *.yaml, *.yml (except for syntax errors)',
      '   • Docs: *.md, README*, CHANGELOG*',
      '',
      '2. NEVER report these (they are NOT bugs):',
      '   • Suggestions ("Consider", "Add", "Should", "Could", "Ensure that", "Validate")',
      '   • Code style ("complex", "magic strings", "readability")',
      '   • Missing validation (TypeScript types handle this)',
      '   • Incomplete/potential issues (unless code WILL crash)',
      '   • Performance opinions (unless exponential complexity)',
      '',
      '3. ONLY report if code WILL:',
      '   • Crash at runtime',
      '   • Lose or corrupt data',
      '   • Have SQL injection, XSS, command injection, or RCE vulnerability',
      '',
      'Return JSON: [{file, line, severity, title, message, suggestion}]',
      '',
      'SUGGESTION FIELD (optional):',
      '  - Only include "suggestion" for FIXABLE issues (not all findings)',
      '  - Fixable: null reference, type error, off-by-one, missing null check, resource leak',
      '  - NOT fixable: architectural issues, design suggestions, unclear requirements',
      '  - "suggestion" must be EXACT replacement code for the problematic line(s)',
      '  - Include ONLY the fixed code, no explanations or comments',
      '  - Example: {"file": "x.ts", "line": 10, "severity": "major",',
      '             "title": "Null reference", "message": "...",',
      '             "suggestion": "const user = users?.find(u => u.id === id) ?? null;"}',
      '',
      `PR #${pr.number}: ${pr.title}`,
      `Author: ${pr.author}`,
      'Files changed:',
      ...fileList,
      ''
    ];

    // Auto-detect and inject defensive programming context
    // Skip for very large diffs to avoid performance impact (>50KB)
    const MAX_DIFF_SIZE_FOR_ANALYSIS = 50000;
    if (diff.length < MAX_DIFF_SIZE_FOR_ANALYSIS) {
      try {
        const defensiveContext = this.validationDetector.analyzeDefensivePatterns(diff);
        const contextText = this.validationDetector.generatePromptContext(defensiveContext);
        if (contextText) {
          instructions.push(contextText, '');
        }
      } catch (error) {
        // If analysis fails, continue without context (fail open, not closed)
        logger.debug('Failed to analyze defensive patterns:', error as Error);
      }
    }

    instructions.push(
      'Diff:',
      diff
    );

    return instructions.join('\n');
  }

  /**
   * Build review prompt with context window validation
   *
   * @param pr - Pull request context
   * @param modelId - Target model ID for context window sizing
   * @returns Prompt string and fit check result
   */
  buildWithValidation(
    pr: PRContext,
    modelId: string
  ): { prompt: string; fitCheck: ContextFitCheck } {
    const prompt = this.build(pr);
    const fitCheck = checkContextWindowFit(prompt, modelId);

    if (!fitCheck.fits) {
      logger.warn(
        `Prompt for ${modelId} exceeds context window: ${fitCheck.promptTokens} tokens > ${fitCheck.availableTokens} available. ` +
        `${fitCheck.recommendation}`
      );
    }

    return { prompt, fitCheck };
  }

  /**
   * Build optimized prompt that fits within context window
   * Automatically trims content if needed
   *
   * @param pr - Pull request context
   * @param modelId - Target model ID
   * @returns Optimized prompt that fits in context window
   */
  buildOptimized(pr: PRContext, modelId: string): string {
    let prompt = this.build(pr);
    let fitCheck = checkContextWindowFit(prompt, modelId);

    if (fitCheck.fits) {
      return prompt; // Already fits
    }

    logger.warn(
      `Prompt exceeds context window for ${modelId}. ` +
      `${fitCheck.promptTokens} tokens > ${fitCheck.availableTokens} available. ` +
      `Trimming diff content...`
    );

    // Strategy: Progressively trim diff until it fits
    // Calculate target diff size based on overage
    const overageTokens = fitCheck.promptTokens - fitCheck.availableTokens;
    const overageBytes = overageTokens * 4; // ~4 bytes per token for UTF-8

    // Calculate new target diff size
    const currentDiffBytes = Buffer.byteLength(pr.diff, 'utf8');
    const targetDiffBytes = Math.max(1000, currentDiffBytes - overageBytes);

    logger.info(
      `Trimming diff from ${currentDiffBytes} to ${targetDiffBytes} bytes to fit context window`
    );

    // Create trimmed PR context
    const trimmedPR = {
      ...pr,
      diff: trimDiff(pr.diff, targetDiffBytes),
    };

    // Build new prompt with trimmed diff
    prompt = this.build(trimmedPR);

    // Verify it fits now
    fitCheck = checkContextWindowFit(prompt, modelId);
    if (!fitCheck.fits) {
      logger.warn(
        `Prompt still exceeds context window after trimming. ` +
        `${fitCheck.promptTokens} tokens > ${fitCheck.availableTokens} available. ` +
        `Provider may fail or truncate.`
      );
    } else {
      logger.info(`Trimmed prompt now fits: ${fitCheck.promptTokens} tokens (${fitCheck.utilizationPercent.toFixed(0)}% utilization)`);
    }

    return prompt;
  }

  /**
   * Estimate token count for a PR without building the full prompt
   * Useful for pre-validation and batch sizing
   */
  estimateTokens(pr: PRContext): number {
    // Quick estimation without building full prompt
    // Base overhead: instructions, file list, formatting
    const baseOverhead = 500; // ~500 tokens for instructions and structure

    // File list: ~20 tokens per file
    const fileListTokens = pr.files.length * 20;

    // Diff tokens (most of the content)
    const diffEstimate = estimateTokensConservative(pr.diff);

    return baseOverhead + fileListTokens + diffEstimate.tokens;
  }

  /**
   * Determine if suggestion instructions should be skipped due to large context
   *
   * Per FR-2.4: Skip suggestion generation when code snippet too large
   * to prevent hallucinated fixes from truncated context.
   *
   * Uses tiered thresholds per CONTEXT.md:
   * - small (4-16k window): skip if diff > 2000 tokens
   * - medium (128-200k window): skip if diff > 80000 tokens
   * - large (1M+ window): skip if diff > 400000 tokens
   */
  private shouldSkipSuggestions(diff: string): boolean {
    const estimate = estimateTokensConservative(diff);

    // Conservative thresholds: skip suggestions if diff alone uses >50% of typical window
    // This leaves room for prompt overhead + response tokens
    const SKIP_THRESHOLD = 50000; // 50k tokens - fits in medium windows, safe margin for small

    if (estimate.tokens > SKIP_THRESHOLD) {
      logger.debug(
        `Skipping suggestion instructions: diff is ${estimate.tokens} tokens (threshold: ${SKIP_THRESHOLD})`
      );
      return true;
    }

    return false;
  }
}
