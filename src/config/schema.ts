import { z } from 'zod';

export const ReviewConfigSchema = z.object({
  providers: z.array(z.string()).optional(),
  synthesis_model: z.string().optional(),
  fallback_providers: z.array(z.string()).optional(),
  provider_allowlist: z.array(z.string()).optional(),
  provider_blocklist: z.array(z.string()).optional(),
  provider_limit: z.number().int().min(0).optional(),
  provider_retries: z.number().int().min(1).optional(),
  provider_max_parallel: z.number().int().min(1).optional(),
  quiet_mode_enabled: z.boolean().optional(),
  quiet_min_confidence: z.number().min(0).max(1).optional(),

  inline_max_comments: z.number().int().min(0).optional(),
  inline_min_severity: z.enum(['critical', 'major', 'minor']).optional(),
  inline_min_agreement: z.number().int().min(1).optional(),

  skip_labels: z.array(z.string()).optional(),
  skip_drafts: z.boolean().optional(),
  skip_bots: z.boolean().optional(),
  min_changed_lines: z.number().int().min(0).optional(),
  max_changed_files: z.number().int().min(0).optional(),

  diff_max_bytes: z.number().int().min(0).optional(),
  run_timeout_seconds: z.number().int().min(1).optional(),

  budget_max_usd: z.number().min(0).optional(),

  enable_ast_analysis: z.boolean().optional(),
  enable_security: z.boolean().optional(),
  enable_caching: z.boolean().optional(),
  enable_test_hints: z.boolean().optional(),
  enable_ai_detection: z.boolean().optional(),
});

export type ReviewConfigFile = z.infer<typeof ReviewConfigSchema>;
