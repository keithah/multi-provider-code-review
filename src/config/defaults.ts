import { ReviewConfig } from '../types';

export const DEFAULT_CONFIG: ReviewConfig = {
  providers: [
    'openrouter/google/gemini-2.0-flash-exp:free',
    'openrouter/mistralai/devstral-2512:free',
    'openrouter/xiaomi/mimo-v2-flash:free',
    'openrouter/qwen/qwen-2.5-coder-32b-instruct:free',
    'openrouter/deepseek/deepseek-r1-distill-llama-70b:free',
    'openrouter/meta-llama/llama-3.1-70b-instruct:free',
  ],
  synthesisModel: 'openrouter/google/gemini-2.0-flash-exp:free',
  fallbackProviders: [
    'openrouter/microsoft/phi-4:free',
    'openrouter/nvidia/llama-3.1-nemotron-70b-instruct:free',
  ],
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

  dryRun: false,
};
