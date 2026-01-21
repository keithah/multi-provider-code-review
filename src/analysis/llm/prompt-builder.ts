import { PRContext, ReviewConfig } from '../../types';
import { trimDiff } from '../../utils/diff';

export class PromptBuilder {
  constructor(private readonly config: ReviewConfig) {}

  build(pr: PRContext): string {
    const diff = trimDiff(pr.diff, this.config.diffMaxBytes);

    return [
      'You are a senior engineer performing a pull request review.',
      'Identify critical, major, and minor issues. Include actionable suggestions when possible.',
      'Return JSON with findings: [{file, line, severity, title, message, suggestion?}] and optional ai_likelihood/ai_reasoning.',
      '',
      `PR #${pr.number}: ${pr.title}`,
      `Author: ${pr.author}`,
      'Files changed:',
      ...pr.files.map(f => `- ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`),
      '',
      'Diff:',
      diff,
    ].join('\n');
  }
}
