import { Finding, ProviderResult } from '../../types';
import { validateSuggestionSanity } from '../../utils/suggestion-sanity';
import { logger } from '../../utils/logger';

export function extractFindings(results: ProviderResult[]): Finding[] {
  const findings: Finding[] = [];

  for (const result of results) {
    if (result.status !== 'success' || !result.result?.findings) continue;
    for (const finding of result.result.findings) {
      // Validate suggestion if present
      // Note: finding.suggestion comes directly from JSON.parse of the LLM response.
      // Provider wrappers return parsed JSON, so the suggestion field (if any) is
      // already on the raw finding object. We just need to validate it.
      let suggestion: string | undefined = undefined;
      if (finding.suggestion !== undefined && finding.suggestion !== null) {
        const validation = validateSuggestionSanity(finding.suggestion);
        if (validation.isValid) {
          suggestion = validation.suggestion;
        } else {
          logger.debug(
            `Skipping invalid suggestion for ${finding.file}:${finding.line}: ${validation.reason}`
          );
        }
      }

      findings.push({
        ...finding,
        suggestion,  // Use validated suggestion (or undefined)
        provider: result.name,
        providers: finding.providers || [result.name],
      });
    }
  }

  return findings;
}
