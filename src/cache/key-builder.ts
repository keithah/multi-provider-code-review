import { createHash } from 'crypto';
import { PRContext, ReviewConfig } from '../types';

export function buildCacheKey(pr: PRContext, configHash?: string): string {
  const hash = createHash('sha1')
    .update(`${pr.baseSha}:${pr.headSha}`)
    .digest('hex')
    .slice(0, 12);

  const suffix = configHash ? `-${configHash}` : '';
  return `mpr-${hash}${suffix}`;
}

/**
 * Hash relevant config fields that affect analysis results
 * Changes to these fields should invalidate the cache
 */
export function hashConfig(config: ReviewConfig): string {
  const relevantConfig = {
    // Analysis toggles
    enableAstAnalysis: config.enableAstAnalysis,
    enableSecurity: config.enableSecurity,
    enableTestHints: config.enableTestHints,
    enableAiDetection: config.enableAiDetection,

    // Graph analysis config
    graphEnabled: config.graphEnabled,
    graphMaxDepth: config.graphMaxDepth,

    // Triviality detection affects which files are analyzed
    skipTrivialChanges: config.skipTrivialChanges,
    trivialPatterns: config.trivialPatterns,

    // Inline comment filtering
    inlineMinSeverity: config.inlineMinSeverity,
    inlineMinAgreement: config.inlineMinAgreement,

    // Intensity affects prompt depth
    pathBasedIntensity: config.pathBasedIntensity,
    pathIntensityPatterns: config.pathIntensityPatterns,
    pathDefaultIntensity: config.pathDefaultIntensity,
  };

  // Deterministic stringify: sort object keys recursively to avoid order-based collisions
  const sortObject = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortObject);
    if (value && typeof value === 'object') {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        sorted[key] = sortObject((value as Record<string, unknown>)[key]);
      }
      return sorted;
    }
    return value;
  };

  const stableJson = JSON.stringify(sortObject(relevantConfig));

  // Use SHA-256 for better collision resistance than MD5
  const hash = createHash('sha256').update(stableJson).digest('hex');

  return hash.slice(0, 16); // Use first 16 chars for better collision resistance
}
