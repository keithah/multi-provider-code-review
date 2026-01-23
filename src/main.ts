import * as core from '@actions/core';
import { ConfigLoader } from './config/loader';
import { createComponents } from './setup';
import { ReviewOrchestrator } from './core/orchestrator';
import { validateRequired, validatePositiveInteger, ValidationError, formatValidationError } from './utils/validation';

function syncEnvFromInputs(): void {
  const inputKeys = [
    'REVIEW_PROVIDERS',
    'FALLBACK_PROVIDERS',
    'SYNTHESIS_MODEL',
    'INLINE_MAX_COMMENTS',
    'INLINE_MIN_SEVERITY',
    'INLINE_MIN_AGREEMENT',
    'MIN_CHANGED_LINES',
    'MAX_CHANGED_FILES',
    'SKIP_LABELS',
    'PROVIDER_LIMIT',
    'PROVIDER_RETRIES',
    'PROVIDER_MAX_PARALLEL',
    'QUIET_MODE_ENABLED',
    'QUIET_MIN_CONFIDENCE',
    'DIFF_MAX_BYTES',
    'RUN_TIMEOUT_SECONDS',
    'BUDGET_MAX_USD',
    'ENABLE_AST_ANALYSIS',
    'ENABLE_SECURITY',
    'ENABLE_CACHING',
    'ENABLE_TEST_HINTS',
    'ENABLE_AI_DETECTION',
    'INCREMENTAL_ENABLED',
    'INCREMENTAL_CACHE_TTL_DAYS',
    'REPORT_BASENAME',
    'DRY_RUN',
  ];

  for (const key of inputKeys) {
    const value = core.getInput(key);
    if (value) {
      process.env[key] = value;
    }
  }
}

async function run(): Promise<void> {
  try {
    syncEnvFromInputs();
    const token = core.getInput('GITHUB_TOKEN') || process.env.GITHUB_TOKEN;

    validateRequired(token, 'GITHUB_TOKEN');

    const config = ConfigLoader.load();
    const components = await createComponents(config, token!);
    const orchestrator = new ReviewOrchestrator(components);

    const prInput = core.getInput('PR_NUMBER') || process.env.PR_NUMBER;
    validateRequired(prInput, 'PR_NUMBER');

    const prNumber = validatePositiveInteger(prInput, 'PR_NUMBER');

    if (config.dryRun) {
      core.info('🔍 DRY RUN MODE - Review will run but no comments will be posted');
    }

    core.info(`Starting review for PR #${prNumber}`);
    const review = await orchestrator.execute(prNumber);

    if (!review) {
      core.info('Review skipped');
      return;
    }

    core.setOutput('findings_count', review.findings.length);
    core.setOutput('critical_count', review.findings.filter(f => f.severity === 'critical').length);
    core.setOutput('cost_usd', review.metrics.totalCost.toFixed(4));
    core.setOutput('total_cost', review.metrics.totalCost.toFixed(4));
    if (review.aiAnalysis) {
      core.setOutput('ai_likelihood', review.aiAnalysis.averageLikelihood);
    }

    core.info('Review completed successfully');
  } catch (error) {
    const err = error as Error;

    if (error instanceof ValidationError) {
      const formatted = formatValidationError(error);
      core.setFailed(`Configuration error:\n${formatted}`);
    } else {
      core.setFailed(`Review failed: ${err.message}`);

      // Add helpful context for common errors
      if (err.message.includes('ENOENT')) {
        core.error('File not found. Check that all file paths are correct.');
      } else if (err.message.includes('EACCES')) {
        core.error('Permission denied. Check file permissions.');
      } else if (err.message.includes('rate limit')) {
        core.error('API rate limit exceeded. Consider using caching or reducing provider count.');
      } else if (err.message.includes('timeout')) {
        core.error('Operation timed out. Consider increasing the timeout value.');
      }
    }

    process.exit(1);
  }
}

run().then(() => {
  process.exit(0);
}).catch((error) => {
  core.setFailed(`Unhandled error: ${error.message}`);
  process.exit(1);
});
