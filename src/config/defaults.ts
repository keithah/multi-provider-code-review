import { ReviewConfig } from '../types';

export const DEFAULT_CONFIG: ReviewConfig = {
  providers: [
    'openrouter/google/gemini-2.0-flash-exp:free',
    'openrouter/mistralai/devstral-2512:free',
  ],
  synthesisModel: 'openrouter/google/gemini-2.0-flash-exp:free',
  fallbackProviders: [],
  providerAllowlist: [],
  providerBlocklist: [],
  providerLimit: 0,
  providerRetries: 2,
  providerMaxParallel: 3,

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
};
