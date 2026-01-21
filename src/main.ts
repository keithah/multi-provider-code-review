import * as core from '@actions/core';
import { ConfigLoader } from './config/loader';
import { createComponents } from './setup';
import { ReviewOrchestrator } from './core/orchestrator';

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
    'DIFF_MAX_BYTES',
    'RUN_TIMEOUT_SECONDS',
    'BUDGET_MAX_USD',
    'ENABLE_AST_ANALYSIS',
    'ENABLE_SECURITY',
    'ENABLE_CACHING',
    'ENABLE_TEST_HINTS',
    'ENABLE_AI_DETECTION',
    'REPORT_BASENAME',
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

    if (!token) {
      throw new Error('GITHUB_TOKEN is required');
    }

    const config = ConfigLoader.load();
    const components = createComponents(config, token);
    const orchestrator = new ReviewOrchestrator(components);

    const prInput = core.getInput('PR_NUMBER') || process.env.PR_NUMBER;
    const prNumber = prInput ? parseInt(prInput, 10) : undefined;
    if (!prNumber || Number.isNaN(prNumber)) {
      throw new Error('PR_NUMBER is required');
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
    core.setFailed(`Review failed: ${(error as Error).message}`);
    throw error;
  }
}

run();
