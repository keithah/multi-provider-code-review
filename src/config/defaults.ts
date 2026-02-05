import { ReviewConfig } from '../types';

export const DEFAULT_CONFIG: ReviewConfig = {
  // Empty array triggers dynamic model discovery
  // Will use OpenRouter's "free" meta-model and discover OpenCode CLI models
  providers: [],
  synthesisModel: 'openrouter/free',
  fallbackProviders: [],
  providerAllowlist: [],
  providerBlocklist: [],

  // COST CONTROLS:
  // - openrouterAllowPaid: false = Only free models (blocks models with $/token pricing)
  // - providerDiscoveryLimit: 8 = Health-check up to 8 providers for reliability
  // - providerLimit: 6 = Actually use only 6 providers to control API usage
  // - budgetMaxUsd: 0 = No budget allocated for paid APIs
  // Combined these settings ensure zero cost when using default configuration
  openrouterAllowPaid: false,  // IMPORTANT: Set to true only if you have OpenRouter credits
  providerDiscoveryLimit: 8,   // Health-check pool size (higher = better reliability)
  providerLimit: 6,             // Actual execution pool size (lower = lower costs)
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

  incrementalEnabled: true, // Re-enabled with broad infrastructure exclusion
  incrementalCacheTtlDays: 7,

  batchMaxFiles: 30,
  providerBatchOverrides: {},
  enableTokenAwareBatching: true,
  targetTokensPerBatch: 50000, // ~50k tokens per batch

  graphEnabled: false,
  graphCacheEnabled: true,
  graphMaxDepth: 5,
  graphTimeoutSeconds: 10,

  generateFixPrompts: false,
  fixPromptFormat: 'plain',

  analyticsEnabled: true,
  analyticsMaxReviews: 1000,
  analyticsDeveloperRate: 100, // USD per hour
  analyticsManualReviewTime: 30, // minutes

  pluginsEnabled: false,
  pluginDir: './plugins',
  pluginAllowlist: [],
  pluginBlocklist: [],

  skipTrivialChanges: true,
  skipDependencyUpdates: true,
  skipDocumentationOnly: true,
  skipFormattingOnly: false, // Disabled by default (may have false positives)
  skipTestFixtures: true,
  skipConfigFiles: true,
  skipBuildArtifacts: true,
  trivialPatterns: [],

  pathBasedIntensity: false, // Disabled by default, opt-in
  pathIntensityPatterns: undefined,
  pathDefaultIntensity: 'standard',

  // Provider selection strategy
  providerSelectionStrategy: 'reliability',
  providerExplorationRate: 0.3,  // 70% exploit, 30% explore

  // Intensity behavior mappings
  intensityProviderCounts: {
    thorough: 8,
    standard: 5,
    light: 3,
  },
  intensityTimeouts: {
    thorough: 180000,  // 3 minutes
    standard: 120000,  // 2 minutes
    light: 60000,      // 1 minute
  },
  intensityPromptDepth: {
    thorough: 'detailed',
    standard: 'standard',
    light: 'brief',
  },

  dryRun: false,
};

/**
 * Static fallback providers used only if dynamic discovery fails
 * (e.g., network issues, API unavailable, CLI not installed)
 */
export const FALLBACK_STATIC_PROVIDERS = [
  'openrouter/free',
];
