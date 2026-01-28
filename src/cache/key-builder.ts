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
    enableAstAnalysis: config.enableAstAnalysis,
    enableSecurity: config.enableSecurity,
    inlineMinSeverity: config.inlineMinSeverity,
    inlineMinAgreement: config.inlineMinAgreement,
    // Add other fields that affect findings
    pathBasedIntensity: config.pathBasedIntensity,
    pathIntensityPatterns: config.pathIntensityPatterns,
    pathDefaultIntensity: config.pathDefaultIntensity,
  };

  const hash = createHash('md5')
    .update(JSON.stringify(relevantConfig))
    .digest('hex');

  return hash.slice(0, 8); // Use first 8 chars
}
