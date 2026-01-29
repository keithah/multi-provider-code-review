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

    const depth = this.config.intensityPromptDepth?.[this.intensity] ?? 'standard';

    const instructions = [
      `You are a senior engineer performing a ${this.intensity} code review.`,
    ];

    // Add depth-specific instructions
    if (depth === 'detailed') {
      instructions.push(
        'Provide extremely thorough analysis including:',
        '- Security implications and vulnerability patterns',
        '- Performance considerations and optimization opportunities',
        '- Edge cases and error handling completeness',
        '- Architectural impact and design patterns',
        '- Testing requirements and coverage gaps',
        '- Documentation completeness and clarity',
        ''
      );
    } else if (depth === 'brief') {
      instructions.push(
        'Focus on high-priority issues:',
        '- Critical bugs and security vulnerabilities',
        '- Major logic errors that affect correctness',
        '- Clear code quality problems',
        ''
      );
    } else {
      instructions.push(
        'Identify critical, major, and minor issues. Include actionable suggestions when possible.',
        ''
      );
    }

    instructions.push(
      'Return JSON with findings: [{file, line, severity, title, message, suggestion?}] and optional ai_likelihood/ai_reasoning.',
      '',
      'IMPORTANT RULES:',
      '- ONLY review files that have diffs shown below',
      '- DO NOT report "missing file" issues - all files listed are intentionally included',
      '- DO NOT report issues about files being "referenced but not in diff"',
      '- Focus on actual code quality, security, and correctness issues in the provided diffs',
      '- BEFORE flagging an issue, check if defensive programming patterns already address it',
      '- typeof checks, null checks, try-catch, and error returns indicate proper validation',
      '- Check line numbers carefully - ensure the flagged line actually contains the issue',
      '',
      'FILE TYPE AWARENESS (CRITICAL - READ CAREFULLY):',
      '',
      '⛔ CRITICAL RULES - READ THESE FIRST:',
      '',
      '1. DO NOT REVIEW TEST FILES FOR CODE QUALITY:',
      '   - Files: *.test.ts, *.spec.ts, __tests__/*, jest.setup.*, test-utils/*',
      '   - Tests intentionally have: edge cases, mocks, incomplete coverage, inconsistent data',
      '   - ONLY flag: SQL injection, XSS, command injection (real security vulnerabilities)',
      '   - NEVER flag: missing tests, missing coverage, test structure, mocks, assertions',
      '',
      '2. DO NOT FLAG WORKFLOW/CI CONFIGURATION ISSUES:',
      '   - Files: .github/workflows/*.yml, .github/actions/*, CI config files',
      '   - These are infrastructure, not application code',
      '   - DO NOT flag: "fork PR security", "secrets exposure", "repository settings"',
      '   - DO NOT flag: "race conditions in workflow", "timeout configuration"',
      '   - These are handled separately and are not code review issues',
      '',
      '3. DO NOT FLAG NEW FILES FOR MISSING TESTS IN DIFF:',
      '   - If a file is added, you only see the file itself, not its tests',
      '   - DO NOT flag: "added without visible tests", "missing test coverage"',
      '   - Tests may exist in separate files not shown in this diff',
      '',
      'Other file types:',
      '- .md files: ONLY flag broken links or security disclosures, NOT formatting/style',
      '- .yml/.yaml files: ONLY flag syntax errors or security issues, NOT style',
      '- .json files: ONLY flag syntax errors, NOT missing fields (could be intentional)',
      '',
      'SEVERITY GUIDELINES (be VERY conservative):',
      '- 🔴 CRITICAL: Data loss, crashes, remote code execution, SQL injection, XSS',
      '- 🟡 MAJOR: Logic errors affecting correctness, race conditions, memory leaks',
      '- 🟢 MINOR: Code style, lint warnings, optimizations, suggestions, test quality',
      '',
      'ABSOLUTELY DO NOT FLAG AS CRITICAL OR MAJOR:',
      '- Anything in test files (*.test.ts, *.spec.ts, __tests__/*)',
      '- Lint warnings (unused variables, unnecessary escapes, etc.)',
      '- Style preferences (const vs let, spacing, naming)',
      '- Documentation formatting (markdown, typos, formatting)',
      '- Test data inconsistencies, missing test cases, test structure',
      '- Commented-out code or TODO comments',
      '- Suggestions starting with "Consider", "Could", "Might want to"',
      '',
      'CONFIDENCE REQUIREMENT:',
      '- If you\'re not >80% confident the issue exists, DO NOT report it',
      '- Better to miss a minor issue than create false positive noise',
      '- When uncertain, check if validation/handling exists elsewhere in the code',
      '',
      `PR #${pr.number}: ${pr.title}`,
      `Author: ${pr.author}`,
      'Files changed:',
      ...fileList,
      ''
    );

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
}
