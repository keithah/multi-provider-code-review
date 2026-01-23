import { FileChange, ImpactAnalysis, UnchangedContext, CodeSnippet } from '../types';

export class ImpactAnalyzer {
  analyze(files: FileChange[], contexts: UnchangedContext[], hasFindings = true): ImpactAnalysis {
    const consumers = this.collectByRelationship(contexts, 'consumer');
    const dependencies = this.collectByRelationship(contexts, 'dependency');
    const callers = this.collectByRelationship(contexts, 'caller');
    const derived = this.collectByRelationship(contexts, 'derived');

    const totalAffected = files.length + contexts.length;
    const impactLevel = hasFindings ? this.calculateImpact(totalAffected, files) : 'low';

    return {
      file: files[0]?.filename ?? 'repository',
      totalAffected,
      callers,
      consumers,
      derived,
      dependencies,
      impactLevel,
      summary: `Touched ${files.length} files with ${contexts.length} related contexts; impact is ${impactLevel}.`,
    };
  }

  private collectByRelationship(contexts: UnchangedContext[], relationship: UnchangedContext['relationship']): CodeSnippet[] {
    return contexts
      .filter(ctx => ctx.relationship === relationship)
      .flatMap(ctx => ctx.affectedCode);
  }

  private calculateImpact(total: number, files: FileChange[]): ImpactAnalysis['impactLevel'] {
    const additions = files.reduce((sum, f) => sum + f.additions, 0);
    const weight = total + additions / 50;

    if (weight > 20) return 'critical';
    if (weight > 12) return 'high';
    if (weight > 4) return 'medium';
    return 'low';
  }
}
