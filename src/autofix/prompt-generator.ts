import { Finding } from '../types';
import { logger } from '../utils/logger';

export type FixPromptFormat = 'cursor' | 'copilot' | 'plain';

export interface FixPrompt {
  file: string;
  line: number;
  finding: string;
  severity: string;
  fixPrompt: string;
  category?: string;
}

export interface FixPromptsOutput {
  format: FixPromptFormat;
  prompts: FixPrompt[];
  totalFindings: number;
  promptsGenerated: number;
}

/**
 * Generates fix suggestions as prompts for AI IDEs (Cursor, GitHub Copilot).
 * Does NOT actually modify code - only generates suggested fix prompts.
 */
export class PromptGenerator {
  constructor(private readonly defaultFormat: FixPromptFormat = 'plain') {}

  /**
   * Generate fix prompts for all findings
   */
  generateFixPrompts(findings: Finding[]): FixPrompt[] {
    logger.info(`Generating fix prompts for ${findings.length} findings`);

    const prompts: FixPrompt[] = [];

    for (const finding of findings) {
      const prompt = this.generatePromptForFinding(finding);
      if (prompt) {
        prompts.push(prompt);
      }
    }

    logger.info(`Generated ${prompts.length} fix prompts`);
    return prompts;
  }

  /**
   * Format prompts for a specific IDE
   */
  formatForIDE(prompts: FixPrompt[], format: FixPromptFormat = this.defaultFormat): string {
    logger.debug(`Formatting ${prompts.length} prompts for ${format}`);

    switch (format) {
      case 'cursor':
        return this.formatForCursor(prompts);
      case 'copilot':
        return this.formatForCopilot(prompts);
      case 'plain':
      default:
        return this.formatPlain(prompts);
    }
  }

  /**
   * Generate output with metadata
   */
  generate(findings: Finding[], format?: FixPromptFormat): FixPromptsOutput {
    const prompts = this.generateFixPrompts(findings);
    const outputFormat = format || this.defaultFormat;

    return {
      format: outputFormat,
      prompts,
      totalFindings: findings.length,
      promptsGenerated: prompts.length,
    };
  }

  /**
   * Generate a fix prompt for a single finding
   */
  private generatePromptForFinding(finding: Finding): FixPrompt | null {
    // Skip if finding doesn't have a suggestion
    if (!finding.suggestion) {
      return null;
    }

    const prompt = this.buildPromptText(finding);

    return {
      file: finding.file,
      line: finding.line,
      finding: finding.title,
      severity: finding.severity,
      fixPrompt: prompt,
      category: finding.category,
    };
  }

  /**
   * Build prompt text from finding
   */
  private buildPromptText(finding: Finding): string {
    const parts: string[] = [];

    // Add context
    parts.push(`Fix the following ${finding.severity} issue in ${finding.file}:${finding.line}`);
    parts.push('');

    // Add issue description
    parts.push(`Issue: ${finding.title}`);
    parts.push(`Details: ${finding.message}`);
    parts.push('');

    // Add suggested fix
    if (finding.suggestion) {
      parts.push('Suggested fix:');
      parts.push(finding.suggestion);
    }

    // Add category context if available
    if (finding.category) {
      parts.push('');
      parts.push(`Category: ${finding.category}`);
    }

    return parts.join('\n');
  }

  /**
   * Format for Cursor AI IDE
   */
  private formatForCursor(prompts: FixPrompt[]): string {
    const lines: string[] = [];

    lines.push('# AI Fix Prompts for Cursor');
    lines.push('');
    lines.push(`Generated ${prompts.length} fix prompts. Use Cursor AI to apply these fixes.`);
    lines.push('');

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      lines.push(`## Fix ${i + 1}: ${prompt.finding} (${prompt.severity})`);
      lines.push('');
      lines.push(`**File:** \`${prompt.file}:${prompt.line}\``);
      lines.push('');
      lines.push('**Prompt for Cursor:**');
      lines.push('```');
      lines.push(prompt.fixPrompt);
      lines.push('```');
      lines.push('');

      // Add instruction for Cursor
      lines.push('**To apply:** Open file in Cursor, position cursor at the line, and use Cmd+K with the prompt above.');
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format for GitHub Copilot
   */
  private formatForCopilot(prompts: FixPrompt[]): string {
    const lines: string[] = [];

    lines.push('# AI Fix Suggestions for GitHub Copilot');
    lines.push('');
    lines.push(`${prompts.length} fixes available. Use Copilot to apply these suggestions.`);
    lines.push('');

    for (const prompt of prompts) {
      lines.push(`### ${prompt.file}:${prompt.line} - ${prompt.finding}`);
      lines.push('');
      lines.push(`**Severity:** ${prompt.severity}`);
      if (prompt.category) {
        lines.push(`**Category:** ${prompt.category}`);
      }
      lines.push('');
      lines.push('**Fix suggestion:**');
      lines.push('```');
      lines.push(prompt.fixPrompt);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format as plain text
   */
  private formatPlain(prompts: FixPrompt[]): string {
    const lines: string[] = [];

    lines.push('AI-Generated Fix Prompts');
    lines.push('='.repeat(50));
    lines.push('');
    lines.push(`Total prompts: ${prompts.length}`);
    lines.push('');

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      lines.push(`[${i + 1}] ${prompt.finding} (${prompt.severity})`);
      lines.push(`    Location: ${prompt.file}:${prompt.line}`);
      if (prompt.category) {
        lines.push(`    Category: ${prompt.category}`);
      }
      lines.push('');
      lines.push('    Fix prompt:');
      const promptLines = prompt.fixPrompt.split('\n');
      for (const line of promptLines) {
        lines.push(`    ${line}`);
      }
      lines.push('');
      lines.push('-'.repeat(50));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Save prompts to a file (for CLI usage)
   */
  async saveToFile(prompts: FixPrompt[], filepath: string, format: FixPromptFormat = this.defaultFormat): Promise<void> {
    const fs = await import('fs/promises');
    const content = this.formatForIDE(prompts, format);
    await fs.writeFile(filepath, content, 'utf8');
    logger.info(`Saved ${prompts.length} fix prompts to ${filepath}`);
  }

  /**
   * Get statistics about generated prompts
   */
  getStats(prompts: FixPrompt[]): {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    byFile: Record<string, number>;
  } {
    const bySeverity: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byFile: Record<string, number> = {};

    for (const prompt of prompts) {
      // By severity
      bySeverity[prompt.severity] = (bySeverity[prompt.severity] || 0) + 1;

      // By category
      if (prompt.category) {
        byCategory[prompt.category] = (byCategory[prompt.category] || 0) + 1;
      }

      // By file
      byFile[prompt.file] = (byFile[prompt.file] || 0) + 1;
    }

    return {
      total: prompts.length,
      bySeverity,
      byCategory,
      byFile,
    };
  }
}
