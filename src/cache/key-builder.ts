import crypto from 'crypto';
import { PRContext } from '../types';

export function buildCacheKey(pr: PRContext): string {
  const hash = crypto
    .createHash('sha1')
    .update(`${pr.baseSha}:${pr.headSha}`)
    .digest('hex')
    .slice(0, 12);
  return `mpr-${hash}`;
}
