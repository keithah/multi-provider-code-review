import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ReviewConfig } from '../types';
import { DEFAULT_CONFIG } from './defaults';
import { ReviewConfigSchema, ReviewConfigFile } from './schema';

export class ConfigLoader {
  private static readonly CONFIG_PATHS = [
    '.github/multi-review.yml',
    '.github/multi-review.yaml',
    '.multi-review.yml',
    '.multi-review.yaml',
  ];

  static load(): ReviewConfig {
    const fileConfig = this.loadFromFile();
    const envConfig = this.loadFromEnv();

    return this.merge(DEFAULT_CONFIG, fileConfig, envConfig);
  }

  private static loadFromFile(): Partial<ReviewConfig> {
    for (const relPath of this.CONFIG_PATHS) {
      const fullPath = path.join(process.cwd(), relPath);
      if (!fs.existsSync(fullPath)) continue;

      try {
        const raw = fs.readFileSync(fullPath, 'utf8');
        const parsed = yaml.load(raw) as Record<string, unknown>;
        const validated = ReviewConfigSchema.parse(parsed);
        return this.normalizeKeys(validated);
      } catch (error) {
        console.warn(`Failed to read config ${relPath}:`, error);
      }
    }

    return {};
  }

  private static loadFromEnv(): Partial<ReviewConfig> {
    const env = process.env;

    return {
      providers: this.parseArray(env.REVIEW_PROVIDERS),
      synthesisModel: env.SYNTHESIS_MODEL,
      fallbackProviders: this.parseArray(env.FALLBACK_PROVIDERS),
      providerAllowlist: this.parseArray(env.PROVIDER_ALLOWLIST),
      providerBlocklist: this.parseArray(env.PROVIDER_BLOCKLIST),
      providerLimit: this.parseNumber(env.PROVIDER_LIMIT),
      providerRetries: this.parseNumber(env.PROVIDER_RETRIES),
      providerMaxParallel: this.parseNumber(env.PROVIDER_MAX_PARALLEL),
      quietModeEnabled: this.parseBoolean(env.QUIET_MODE_ENABLED),
      quietMinConfidence: this.parseFloat(env.QUIET_MIN_CONFIDENCE),

      inlineMaxComments: this.parseNumber(env.INLINE_MAX_COMMENTS),
      inlineMinSeverity: this.parseSeverity(env.INLINE_MIN_SEVERITY),
      inlineMinAgreement: this.parseNumber(env.INLINE_MIN_AGREEMENT),

      skipLabels: this.parseArray(env.SKIP_LABELS),
      skipDrafts: this.parseBoolean(env.SKIP_DRAFTS),
      skipBots: this.parseBoolean(env.SKIP_BOTS),
      minChangedLines: this.parseNumber(env.MIN_CHANGED_LINES),
      maxChangedFiles: this.parseNumber(env.MAX_CHANGED_FILES),

      diffMaxBytes: this.parseNumber(env.DIFF_MAX_BYTES),
      runTimeoutSeconds: this.parseNumber(env.RUN_TIMEOUT_SECONDS),

      budgetMaxUsd: this.parseFloat(env.BUDGET_MAX_USD),

      enableAstAnalysis: this.parseBoolean(env.ENABLE_AST_ANALYSIS),
      enableSecurity: this.parseBoolean(env.ENABLE_SECURITY),
      enableCaching: this.parseBoolean(env.ENABLE_CACHING),
      enableTestHints: this.parseBoolean(env.ENABLE_TEST_HINTS),
      enableAiDetection: this.parseBoolean(env.ENABLE_AI_DETECTION),
    };
  }

  private static normalizeKeys(config: ReviewConfigFile): Partial<ReviewConfig> {
    return {
      providers: config.providers,
      synthesisModel: config.synthesis_model,
      fallbackProviders: config.fallback_providers,
      providerAllowlist: config.provider_allowlist,
      providerBlocklist: config.provider_blocklist,
      providerLimit: config.provider_limit,
      providerRetries: config.provider_retries,
      providerMaxParallel: config.provider_max_parallel,
      quietModeEnabled: config.quiet_mode_enabled,
      quietMinConfidence: config.quiet_min_confidence,
      inlineMaxComments: config.inline_max_comments,
      inlineMinSeverity: config.inline_min_severity,
      inlineMinAgreement: config.inline_min_agreement,
      skipLabels: config.skip_labels,
      skipDrafts: config.skip_drafts,
      skipBots: config.skip_bots,
      minChangedLines: config.min_changed_lines,
      maxChangedFiles: config.max_changed_files,
      diffMaxBytes: config.diff_max_bytes,
      runTimeoutSeconds: config.run_timeout_seconds,
      budgetMaxUsd: config.budget_max_usd,
      enableAstAnalysis: config.enable_ast_analysis,
      enableSecurity: config.enable_security,
      enableCaching: config.enable_caching,
      enableTestHints: config.enable_test_hints,
      enableAiDetection: config.enable_ai_detection,
    };
  }

  private static merge(
    defaults: ReviewConfig,
    ...overrides: Array<Partial<ReviewConfig>>
  ): ReviewConfig {
    return overrides.reduce<ReviewConfig>((acc, curr) => {
      const next: Partial<ReviewConfig> = {};
      for (const [key, value] of Object.entries(curr)) {
        if (value === undefined || value === null) continue;
        const typedKey = key as keyof ReviewConfig;
        next[typedKey] = value as never;
      }
      return { ...acc, ...next } as ReviewConfig;
    }, defaults);
  }

  private static parseArray(value?: string): string[] | undefined {
    if (!value) return undefined;
    return value
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
  }

  private static parseBoolean(value?: string): boolean | undefined {
    if (value === undefined) return undefined;
    return value.toLowerCase() === 'true';
  }

  private static parseNumber(value?: string): number | undefined {
    if (!value) return undefined;
    const num = parseInt(value, 10);
    return Number.isFinite(num) ? num : undefined;
  }

  private static parseFloat(value?: string): number | undefined {
    if (!value) return undefined;
    const num = Number.parseFloat(value);
    return Number.isFinite(num) ? num : undefined;
  }

  private static parseSeverity(value?: string): 'critical' | 'major' | 'minor' | undefined {
    if (!value) return undefined;
    const normalized = value.toLowerCase();
    if (normalized === 'critical' || normalized === 'major' || normalized === 'minor') {
      return normalized as 'critical' | 'major' | 'minor';
    }
    return undefined;
  }
}
