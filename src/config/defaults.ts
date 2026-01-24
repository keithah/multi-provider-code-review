import { ReviewConfig } from '../types';

export const DEFAULT_CONFIG: ReviewConfig = {
  // Empty array triggers dynamic model discovery
  // Will auto-discover best free models from OpenRouter API and OpenCode CLI
  providers: [],
  synthesisModel: 'openrouter/google/gemini-2.0-flash-exp:free',
  fallbackProviders: [],
  providerAllowlist: [],
  providerBlocklist: [],
  providerLimit: 6,
  providerRetries: 2,
  providerMaxParallel: 3,
  quietModeEnabled: false,
  quietMinConfidence: 0.5,
  quietUseLearning: true,
  learningEnabled: true,
  learningMinFeedbackCount: 5,
  learningLookbackDays: 30,

  inlineMaxComments: 5,
  inlineMinSeverity: 'major',
  inlineMinAgreement: 2,

  skipLabels: [],
  skipDrafts: false,
  skipBots: true,
  minChangedLines: 0,
  maxChangedFiles: 0,

  diffMaxBytes: 120_000,
  runTimeoutSeconds: 600,

  budgetMaxUsd: 0,

  enableAstAnalysis: true,
  enableSecurity: true,
  enableCaching: true,
  enableTestHints: true,
  enableAiDetection: true,

  incrementalEnabled: true,
  incrementalCacheTtlDays: 7,

  graphEnabled: true,
  graphCacheEnabled: true,
  graphMaxDepth: 5,
  graphTimeoutSeconds: 10,

  generateFixPrompts: false,
  fixPromptFormat: 'plain',

  analyticsEnabled: true,
  analyticsMaxReviews: 1000,

  pluginsEnabled: false,
  pluginDir: './plugins',
  pluginAllowlist: [],
  pluginBlocklist: [],

  dryRun: false,
};

/**
 * Static fallback providers used only if dynamic discovery fails
 * (e.g., network issues, API unavailable, CLI not installed)
 */
export const FALLBACK_STATIC_PROVIDERS = [
  'openrouter/mistralai/devstral-2512:free',
  'openrouter/xiaomi/mimo-v2-flash:free',
];
