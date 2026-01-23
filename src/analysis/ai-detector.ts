import { AIAnalysis, ProviderResult } from '../types';

export function summarizeAIDetection(results: ProviderResult[]): AIAnalysis | undefined {
  const estimates: Record<string, number> = {};

  for (const result of results) {
    const likelihood = result.result?.aiLikelihood;
    if (result.status === 'success' && typeof likelihood === 'number') {
      estimates[result.name] = likelihood;
    }
  }

  const providers = Object.keys(estimates);
  if (providers.length === 0) return undefined;

  const average = providers.reduce((sum, key) => sum + estimates[key], 0) / providers.length;
  const consensus = average > 0.7 ? 'High' : average > 0.4 ? 'Medium' : 'Low';

  return {
    averageLikelihood: average,
    providerEstimates: estimates,
    consensus,
  };
}
