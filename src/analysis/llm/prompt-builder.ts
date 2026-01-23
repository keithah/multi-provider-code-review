import { PRContext, ReviewConfig } from '../../types';
import { trimDiff } from '../../utils/diff';

export class PromptBuilder {
  constructor(private readonly config: ReviewConfig) {}

  build(pr: PRContext): string {
    const diff = trimDiff(pr.diff, this.config.diffMaxBytes);

    // Extract which files are actually in the trimmed diff to avoid false positives
    const filesInDiff = new Set<string>();
    const diffGitPattern = /^diff --git a\/(.+?) b\/(.+?)$/gm;
    let match;
    while ((match = diffGitPattern.exec(diff)) !== null) {
      filesInDiff.add(match[2]); // Use the "b/" path (destination)
    }

    // Filter file list to only show files that are in the diff
    const includedFiles = pr.files.filter(f => filesInDiff.has(f.filename));
    const excludedCount = pr.files.length - includedFiles.length;

    const fileList = [
      ...includedFiles.map(f => `- ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`),
    ];

    if (excludedCount > 0) {
      fileList.push(`  (${excludedCount} additional file(s) truncated)`);
    }

    const instructions = [
      'You are a senior engineer performing a pull request review.',
      'Identify critical, major, and minor issues. Include actionable suggestions when possible.',
      'Return JSON with findings: [{file, line, severity, title, message, suggestion?}] and optional ai_likelihood/ai_reasoning.',
      '',
      'IMPORTANT RULES:',
      '- ONLY review files that have diffs shown below',
      '- DO NOT report "missing file" issues - all files listed are intentionally included',
      '- DO NOT report issues about files being "referenced but not in diff"',
      '- Focus on actual code quality, security, and correctness issues in the provided diffs',
      '',
      `PR #${pr.number}: ${pr.title}`,
      `Author: ${pr.author}`,
      'Files changed:',
      ...fileList,
      '',
      'Diff:',
      diff,
    ];

    return instructions.join('\n');
  }
}
