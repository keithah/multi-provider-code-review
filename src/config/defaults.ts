import { ReviewConfig } from '../types';

export const DEFAULT_CONFIG: ReviewConfig = {
  providers: [
    'opencode/minimax-m2.1-free',
    'opencode/big-pickle',
    'opencode/grok-code',
    'opencode/glm-4.7-free',
  ],
  synthesisModel: 'openrouter/google/gemini-2.0-flash-exp:free',
  fallbackProviders: ['opencode/minimax-m2.1-free'],
  providerAllowlist: [],
  providerBlocklist: [],
  providerLimit: 6,
  providerRetries: 2,
  providerMaxParallel: 3,
  quietModeEnabled: false,
  quietMinConfidence: 0.5,

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

  dryRun: false,
};
