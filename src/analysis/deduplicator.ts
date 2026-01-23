import { Finding } from '../types';

export class Deduplicator {
  dedupe(findings: Finding[]): Finding[] {
    const map = new Map<string, Finding>();

    for (const finding of findings) {
      const key = `${finding.file}:${finding.line}:${finding.title}`;
      if (!map.has(key)) {
        map.set(key, finding);
      } else {
        const existing = map.get(key)!;
        const providers = new Set([
          ...(existing.providers || []),
          ...(finding.providers || []),
          existing.provider,
          finding.provider,
        ].filter(Boolean) as string[]);
        map.set(key, { ...existing, providers: Array.from(providers) });
      }
    }

    return Array.from(map.values());
  }
}
