/**
 * Finding Filter - Post-processes LLM findings to reduce false positives
 *
 * This filter runs AFTER the LLM generates findings and automatically:
 * - Downgrades severity for lint/style issues
 * - Filters out findings in wrong file types
 * - Removes findings for code that exists (missing method false positives)
 * - Downgrades low-confidence findings
 *
 * This is a safety net for when prompt instructions aren't followed.
 */

import { Finding } from '../types';
import { logger } from '../utils/logger';

export interface FilterStats {
  total: number;
  filtered: number;
  downgraded: number;
  kept: number;
  reasons: Record<string, number>;
}

export class FindingFilter {
  /**
   * Filter and adjust findings to reduce false positives
   */
  filter(findings: Finding[], diffContent: string): { findings: Finding[]; stats: FilterStats } {
    const stats: FilterStats = {
      total: findings.length,
      filtered: 0,
      downgraded: 0,
      kept: 0,
      reasons: {},
    };

    const filtered: Finding[] = [];

    for (const finding of findings) {
      const action = this.shouldFilter(finding, diffContent);

      if (action === 'filter') {
        stats.filtered++;
        const reason = this.getFilterReason(finding, diffContent);
        stats.reasons[reason] = (stats.reasons[reason] || 0) + 1;
        logger.debug(`Filtered finding: ${finding.title} (${reason})`);
        continue;
      }

      if (action === 'downgrade' && finding.severity === 'critical') {
        finding.severity = 'minor';
        stats.downgraded++;
        logger.debug(`Downgraded finding: ${finding.title} (critical → minor)`);
      } else if (action === 'downgrade' && finding.severity === 'major') {
        finding.severity = 'minor';
        stats.downgraded++;
        logger.debug(`Downgraded finding: ${finding.title} (major → minor)`);
      }

      filtered.push(finding);
      stats.kept++;
    }

    // Deduplicate similar findings (same file + similar title)
    const deduplicated = this.deduplicateFindings(filtered);
    const duplicatesRemoved = filtered.length - deduplicated.length;

    if (duplicatesRemoved > 0) {
      stats.filtered += duplicatesRemoved;
      stats.kept -= duplicatesRemoved;
      stats.reasons['duplicate finding'] = (stats.reasons['duplicate finding'] || 0) + duplicatesRemoved;
      logger.debug(`Removed ${duplicatesRemoved} duplicate findings`);
    }

    if (stats.filtered > 0 || stats.downgraded > 0) {
      logger.info(
        `Finding filter: ${stats.filtered} filtered, ${stats.downgraded} downgraded, ${stats.kept} kept (from ${stats.total} total)`
      );
    }

    return { findings: deduplicated, stats };
  }

  private shouldFilter(finding: Finding, diffContent: string): 'filter' | 'downgrade' | 'keep' {
    // Filter: Documentation/markdown files should only flag broken links or security
    if (this.isDocumentationFile(finding.file)) {
      if (this.isStyleOrFormattingIssue(finding)) {
        return 'filter';
      }
      if (finding.severity === 'critical' || finding.severity === 'major') {
        return 'downgrade'; // Docs issues rarely deserve critical/major
      }
    }

    // Aggressive filtering for test files - tests are not production code
    if (this.isTestFile(finding.file) || this.isTestInfrastructure(finding.file)) {
      // Only keep security vulnerabilities in test files (SQL injection, XSS, etc.)
      if (this.isTrueSecurityIssue(finding)) {
        return 'keep';
      }

      // Filter common false positives in tests
      if (this.isTestCodeQualityIssue(finding)) {
        return 'filter';
      }

      // Downgrade everything else in test files to minor
      if (finding.severity === 'critical' || finding.severity === 'major') {
        return 'downgrade';
      }
    }

    // Downgrade: Lint/style issues should never be critical
    if (this.isLintOrStyleIssue(finding)) {
      if (finding.severity === 'critical' || finding.severity === 'major') {
        return 'downgrade';
      }
    }

    // Filter: "Missing method" when method exists in diff
    if (this.isMissingMethodFalsePositive(finding, diffContent)) {
      return 'filter';
    }

    // Filter: Workflow security checks that are already implemented
    if (this.isWorkflowSecurityFalsePositive(finding, diffContent)) {
      return 'filter';
    }

    // Downgrade: Suggestions/optimizations should never be critical
    if (this.isSuggestionOrOptimization(finding)) {
      if (finding.severity === 'critical') {
        return 'downgrade';
      }
    }

    // Filter: Line number issues (flagging blank lines, closing braces)
    if (this.isLineNumberIssue(finding, diffContent)) {
      return 'filter';
    }

    return 'keep';
  }

  private getFilterReason(finding: Finding, diffContent: string): string {
    if (this.isDocumentationFile(finding.file) && this.isStyleOrFormattingIssue(finding)) {
      return 'documentation formatting';
    }
    if ((this.isTestFile(finding.file) || this.isTestInfrastructure(finding.file)) && this.isTestCodeQualityIssue(finding)) {
      return 'test code quality (not production issue)';
    }
    if (this.isTestFile(finding.file) && this.isIntentionalTestPattern(finding)) {
      return 'intentional test pattern';
    }
    if (this.isWorkflowSecurityFalsePositive(finding, diffContent)) {
      return 'workflow security already implemented';
    }
    if (this.isMissingMethodFalsePositive(finding, diffContent)) {
      return 'method exists in code';
    }
    if (this.isLineNumberIssue(finding, diffContent)) {
      return 'invalid line number';
    }
    return 'other';
  }

  private isDocumentationFile(file: string): boolean {
    return /\.(md|txt|rst)$/i.test(file);
  }

  private isTestFile(file: string): boolean {
    return /\.(test|spec)\.(ts|js|tsx|jsx)$/i.test(file) || file.includes('__tests__');
  }

  private isTestInfrastructure(file: string): boolean {
    // Test setup, configuration, and helpers
    return (
      file.includes('jest.setup') ||
      file.includes('jest.config') ||
      file.includes('test-utils') ||
      file.includes('test-helpers') ||
      file.includes('__mocks__') ||
      file.includes('fixtures/')
    );
  }

  private isTrueSecurityIssue(finding: Finding): boolean {
    const text = (finding.title + ' ' + finding.message).toLowerCase();
    return (
      text.includes('sql injection') ||
      text.includes('xss') ||
      text.includes('cross-site scripting') ||
      text.includes('command injection') ||
      text.includes('path traversal') ||
      text.includes('remote code execution') ||
      text.includes('arbitrary code') ||
      text.includes('prototype pollution')
    );
  }

  private isTestCodeQualityIssue(finding: Finding): boolean {
    const text = (finding.title + ' ' + finding.message).toLowerCase();
    return (
      // Test coverage and completeness
      text.includes('missing edge case') ||
      text.includes('missing test case') ||
      text.includes('missing test') ||
      text.includes('test coverage') ||
      text.includes('not tested') ||
      // Test structure and organization
      text.includes('test structure') ||
      text.includes('test organization') ||
      text.includes('test duplicate') ||
      // Test data and mocks
      text.includes('mock') ||
      text.includes('stub') ||
      text.includes('fixture') ||
      text.includes('test data') ||
      text.includes('inconsistent') ||
      text.includes('mismatch') ||
      // Test assertions
      text.includes('assertion') ||
      text.includes('expect') ||
      // Documentation in tests
      text.includes('test documentation') ||
      text.includes('test comment')
    );
  }

  private isStyleOrFormattingIssue(finding: Finding): boolean {
    const text = (finding.title + ' ' + finding.message).toLowerCase();
    return (
      text.includes('formatting') ||
      text.includes('markdown') ||
      text.includes('heading') ||
      text.includes('whitespace') ||
      text.includes('indentation') ||
      text.includes('spacing') ||
      text.includes('bare url') ||
      text.includes('language specified') ||
      text.includes('code block') ||
      text.includes('fenced code') ||
      text.includes('emphasis') ||
      text.includes('hyphen')
    );
  }

  private isLintOrStyleIssue(finding: Finding): boolean {
    const text = (finding.title + ' ' + finding.message).toLowerCase();
    return (
      text.includes('unused variable') ||
      text.includes('unused parameter') ||
      text.includes('no-unused') ||
      text.includes('escape character') ||
      text.includes('no-useless-escape') ||
      text.includes('const instead of let') ||
      text.includes('prefer const') ||
      text.includes('naming convention') ||
      text.includes('camelcase') ||
      text.includes('snake_case') ||
      text.includes('eslint') ||
      text.includes('lint')
    );
  }

  private isIntentionalTestPattern(finding: Finding): boolean {
    const text = (finding.title + ' ' + finding.message).toLowerCase();
    return (
      text.includes('test') &&
      (text.includes('inconsistent') ||
        text.includes('empty') ||
        text.includes('mock') ||
        text.includes('mismatch') ||
        text.includes('intentional'))
    );
  }

  private isMissingMethodFalsePositive(finding: Finding, diffContent: string): boolean {
    const text = (finding.title + ' ' + finding.message).toLowerCase();

    // Check if finding claims something is "missing"
    if (!text.includes('missing') && !text.includes('lacks') && !text.includes('no ')) {
      return false;
    }

    // Extract method/function name from the finding
    const methodMatch = text.match(/\b(serialize|deserialize|clone|copyFrom|remove|add|get|set)\w*\b/);
    if (!methodMatch) {
      return false;
    }

    const methodName = methodMatch[0];

    // Check if the method actually exists in the diff
    const methodRegex = new RegExp(`(function\\s+${methodName}|${methodName}\\s*\\(|${methodName}:\\s*function)`, 'i');
    if (methodRegex.test(diffContent)) {
      logger.debug(`Method ${methodName} exists in diff, filtering "missing ${methodName}" finding`);
      return true;
    }

    return false;
  }

  private isSuggestionOrOptimization(finding: Finding): boolean {
    const text = (finding.title + ' ' + finding.message).toLowerCase();
    return (
      text.includes('consider') ||
      text.includes('suggestion') ||
      text.includes('could') ||
      text.includes('might want to') ||
      text.includes('optimization') ||
      text.includes('improvement')
    );
  }

  private isWorkflowSecurityFalsePositive(finding: Finding, diffContent: string): boolean {
    // Only apply to workflow files
    if (!finding.file.includes('.github/workflows/')) {
      return false;
    }

    const text = (finding.title + ' ' + finding.message).toLowerCase();

    // Check if it's about fork PR security
    if (text.includes('fork') && text.includes('secret')) {
      // Check if the diff shows security checks are already in place
      const hasForkSecurityCheck = (
        diffContent.includes('SECURITY VIOLATION') ||
        diffContent.includes('Fork PR has access to secrets') ||
        diffContent.includes('if [ -n "$OPENROUTER_API_KEY" ]')
      );

      if (hasForkSecurityCheck) {
        logger.debug(`Workflow security already implemented: ${finding.title}`);
        return true;
      }
    }

    return false;
  }

  private isLineNumberIssue(finding: Finding, diffContent: string): boolean {
    if (!finding.line) {
      return false; // No line number to check
    }

    // Extract the line from the diff
    const lines = diffContent.split('\n');
    const lineIndex = finding.line - 1;

    if (lineIndex < 0 || lineIndex >= lines.length) {
      return false; // Line number out of bounds
    }

    const line = lines[lineIndex].trim();

    // Check if the line is just a closing brace, blank, or comment
    if (
      line === '' ||
      line === '}' ||
      line === '};' ||
      line === '])' ||
      line === ']);' ||
      line.startsWith('//') ||
      line.startsWith('/*') ||
      line.startsWith('*')
    ) {
      logger.debug(`Line ${finding.line} is blank/brace/comment, likely incorrect line number`);
      return true;
    }

    return false;
  }

  /**
   * Remove duplicate findings that are essentially the same issue
   * Uses file + title similarity to detect duplicates
   */
  private deduplicateFindings(findings: Finding[]): Finding[] {
    const seen = new Map<string, Finding>();

    for (const finding of findings) {
      // Create a dedup key from file + normalized title
      const normalizedTitle = finding.title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      const key = `${finding.file}:${normalizedTitle}`;

      // If we haven't seen this finding, keep it
      // If we have, keep the one with more severe severity
      if (!seen.has(key)) {
        seen.set(key, finding);
      } else {
        const existing = seen.get(key)!;
        // Keep the more severe one
        const severityOrder = { critical: 3, major: 2, minor: 1 };
        const existingSeverity = severityOrder[existing.severity];
        const newSeverity = severityOrder[finding.severity];

        if (newSeverity > existingSeverity) {
          seen.set(key, finding);
        }
      }
    }

    return Array.from(seen.values());
  }
}
