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

    // COMPLETELY filter test files - prompt explicitly says "DO NOT review test files"
    if (this.isTestFile(finding.file) || this.isTestInfrastructure(finding.file)) {
      // Only keep true security vulnerabilities (SQL injection, XSS, RCE)
      if (this.isTrueSecurityIssue(finding)) {
        return 'keep';
      }
      // Everything else in test files is filtered - NO exceptions
      return 'filter';
    }

    // COMPLETELY filter workflow/CI files - prompt explicitly says "DO NOT review workflow/CI files"
    if (this.isWorkflowOrCIFile(finding.file)) {
      // Filter ALL workflow/CI findings - NO exceptions
      // Workflow configuration is infrastructure, not application code
      return 'filter';
    }

    // Filter: Suggestions/optimizations should never be reported as issues (check early!)
    if (this.isSuggestionOrOptimization(finding)) {
      return 'filter';
    }

    // Filter: Findings about files added in the diff (complaints about new files)
    if (this.isAboutAddedFileFalsePositive(finding)) {
      return 'filter';
    }

    // Filter: Subjective code structure opinions
    if (this.isSubjectiveCodeOpinion(finding)) {
      return 'filter';
    }

    // Filter: Invalid or suspicious line numbers (check before downgrade logic)
    if (this.hasInvalidLineNumber(finding)) {
      return 'filter';
    }

    // COMPLETELY filter code quality issues - prompt explicitly says not to report these
    if (this.isCodeQualityIssue(finding)) {
      return 'filter';
    }

    // COMPLETELY filter lint/style issues - prompt explicitly says not to report these
    if (this.isLintOrStyleIssue(finding)) {
      return 'filter';
    }

    // Filter: "Missing method" when method exists in diff
    if (this.isMissingMethodFalsePositive(finding, diffContent)) {
      return 'filter';
    }

    // Filter: Workflow security checks that are already implemented
    if (this.isWorkflowSecurityFalsePositive(finding, diffContent)) {
      return 'filter';
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
    if (this.isWorkflowOrCIFile(finding.file) && this.isWorkflowConfigurationIssue(finding)) {
      return 'workflow/CI configuration (not application code)';
    }
    if (this.isWorkflowSecurityFalsePositive(finding, diffContent)) {
      return 'workflow security already handled/config issue';
    }
    if (this.isSuggestionOrOptimization(finding)) {
      return 'suggestion/optimization (not a bug)';
    }
    if (this.isSubjectiveCodeOpinion(finding)) {
      return 'subjective code opinion (not a bug)';
    }
    if (this.isAboutAddedFileFalsePositive(finding)) {
      return 'complaint about file added in diff';
    }
    if (this.isMissingMethodFalsePositive(finding, diffContent)) {
      return 'method exists in code';
    }
    if (this.hasInvalidLineNumber(finding)) {
      return 'invalid/suspicious line number';
    }
    if (this.isLineNumberIssue(finding, diffContent)) {
      return 'line number points to blank/brace/comment';
    }
    return 'other';
  }

  private isDocumentationFile(file: string): boolean {
    return /\.(md|txt|rst)$/i.test(file);
  }

  private isTestFile(file: string): boolean {
    const normalized = file.toLowerCase();
    return (
      /\.(test|spec)\.(ts|js|tsx|jsx)$/i.test(file) ||
      file.includes('__tests__/') ||
      normalized.includes('/tests/') ||
      normalized.includes('/test/') ||
      normalized.startsWith('tests/') ||
      normalized.startsWith('test/') ||
      file.includes('__test__/')
    );
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

  private isWorkflowOrCIFile(file: string): boolean {
    const normalized = file.toLowerCase();
    return (
      normalized.includes('.github/workflows/') ||
      normalized.includes('.github/actions/') ||
      normalized.includes('.circleci/') ||
      normalized.includes('.travis.yml') ||
      normalized.includes('azure-pipelines') ||
      normalized.includes('gitlab-ci.yml') ||
      normalized.includes('.yml') && normalized.includes('.github') ||
      normalized.includes('.yaml') && normalized.includes('.github') ||
      file === 'Jenkinsfile'
    );
  }

  private isWorkflowConfigurationIssue(finding: Finding): boolean {
    const text = (finding.title + ' ' + finding.message).toLowerCase();

    return (
      // Fork PR / secrets issues (very common false positives)
      (text.includes('fork') && (text.includes('secret') || text.includes('pr') || text.includes('pull request') || text.includes('security'))) ||
      (text.includes('pull request') && text.includes('secret')) ||
      text.includes('repository setting') ||
      text.includes('send secrets to workflows') ||
      text.includes('secret validation') ||
      text.includes('secret exposure') ||
      text.includes('secrets exposure') ||
      text.includes('secret access') ||
      text.includes('security gating') ||
      text.includes('security guardrails') ||
      text.includes('security assumption') ||
      text.includes('fork pr') && (text.includes('access') || text.includes('gating') || text.includes('condition') || text.includes('handling') || text.includes('risk')) ||
      text.includes('security risk') && text.includes('fork') ||
      text.includes('security vulnerability') && text.includes('fork') ||
      text.includes('security: fork prs') ||
      // Workflow event/condition configuration
      text.includes('workflow relies on') ||
      text.includes('timeout') && (text.includes('workflow') || text.includes('test') || text.includes('ci')) ||
      text.includes('testtimeout') ||
      text.includes('runner configuration') ||
      text.includes('concurrency') && (text.includes('group') || text.includes('grouping') || text.includes('issue') || text.includes('strategy')) ||
      text.includes('fork pr detection') ||
      text.includes('fork pr handling') ||
      text.includes('conditional logic') && text.includes('workflow') ||
      text.includes('job condition') ||
      text.includes('workflow') && text.includes('logic') ||
      text.includes('condition') && (text.includes('fork') || text.includes('event')) ||
      text.includes('doesn\'t account for') && text.includes('event') ||
      text.includes('modify condition to') ||
      text.includes('event type') && text.includes('check') ||
      text.includes('simplify the logic to') ||
      text.includes('fail the workflow') ||
      // CI-specific issues
      text.includes('detectopenhandles') ||
      text.includes('--detectopenhandles') ||
      text.includes('--testtimeout') ||
      text.includes('ci test flags') ||
      text.includes('test execution control') ||
      text.includes('test execution flags') ||
      text.includes('--forceexit') ||
      text.includes('test execution') && text.includes('improved')
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
      text.includes('add tests') ||
      text.includes('add targeted') && text.includes('test') ||
      text.includes('tests rely') ||
      text.includes('test reliance') ||
      // Test structure and organization
      text.includes('test structure') ||
      text.includes('test organization') ||
      text.includes('test duplicate') ||
      // Test data and mocks
      text.includes('mock') ||
      text.includes('stub') ||
      text.includes('fixture') ||
      text.includes('test data') ||
      text.includes('inconsistent') && text.includes('test') ||
      text.includes('mismatch') ||
      // Test assertions
      text.includes('assertion') ||
      text.includes('expect') ||
      // Documentation in tests
      text.includes('test documentation') ||
      text.includes('test comment') ||
      // Test isolation and shared state
      text.includes('test isolation') ||
      text.includes('shared mock') ||
      text.includes('mock') && text.includes('across tests') ||
      // Test implementation details
      text.includes('hard-coded') && text.includes('test') ||
      text.includes('stat-key brittleness') ||
      text.includes('brittleness') && text.includes('test') ||
      text.includes('brittle test') ||
      text.includes('tightly coupled') && text.includes('test') ||
      text.includes('test expectations') ||
      text.includes('deduplication heuristic') ||
      text.includes('reason keys') ||
      // Test refactoring suggestions
      text.includes('parameterized tests') ||
      text.includes('downgrade-path constants') ||
      text.includes('reduce brittleness') ||
      // Test validation suggestions
      text.includes('validate mocks') ||
      text.includes('validate') && text.includes('test') && text.includes('reflect') ||
      text.includes('concurrency scenarios') && text.includes('test') ||
      text.includes('comprehensive') && text.includes('test') ||
      text.includes('serialization') && text.includes('circular') && text.includes('graph') ||
      // Test-related suggestions
      text.includes('without explicit type contracts') ||
      text.includes('api docs and unit tests')
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
      text.includes('magic string') ||
      text.includes('magic number') ||
      text.includes('eslint') ||
      text.includes('lint') ||
      text.includes('unsafe type assertion') ||
      text.includes('unsafe non-null assertion') ||
      text.includes('type assertion') && !this.isTrueSecurityIssue(finding) ||
      text.includes('non-null assertion') && !this.isTrueSecurityIssue(finding) ||
      text.includes('bypasses type checking') ||
      text.includes('casting') && text.includes('any')
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

    // Extract method/function name from the finding (text is already lowercased)
    const methodMatch = text.match(/\b(serialize|deserialize|clone|copyfrom|remove|add|get|set)\w*\b/);
    if (!methodMatch) {
      return false;
    }

    const methodName = methodMatch[0];

    // Check if the method actually exists in the diff (case-insensitive search)
    const methodRegex = new RegExp(`(function\\s+${methodName}|${methodName}\\s*\\(|${methodName}:\\s*function)`, 'i');
    if (methodRegex.test(diffContent)) {
      logger.debug(`Method ${methodName} exists in diff, filtering "missing ${methodName}" finding`);
      return true;
    }

    return false;
  }

  private isSuggestionOrOptimization(finding: Finding): boolean {
    // CRITICAL: Never filter true security issues, even if they use suggestion language
    // Example: "Missing validation could lead to SQL injection" contains "could lead to"
    // but is a real security issue that must not be filtered
    if (this.isTrueSecurityIssue(finding)) {
      return false;
    }

    const text = (finding.title + ' ' + finding.message).toLowerCase();
    return (
      // Explicit suggestions
      text.includes('consider') ||
      text.includes('suggestion') ||
      text.includes('could') ||
      text.includes('should') ||
      text.includes('might want to') ||
      text.includes('might be') ||
      text.includes('may be') ||
      text.includes('can be') ||
      text.includes('optimization') ||
      text.includes('improvement') ||
      // Opinion words (not factual bugs)
      text.includes('overly') ||
      text.includes('too aggressive') ||
      text.includes('less aggressive') ||
      // Imperatives that are suggestions, not bugs
      text.includes('ensure that') ||
      text.includes('ensure') && (text.includes('consistent') || text.includes('handle') || text.includes('uniqueness') || text.includes('comprehensive') || text.includes('proper') || text.includes('correct')) ||
      text.includes('verify that') ||
      text.includes('validate') && !text.includes('unvalidated') ||
      text.includes('establish') ||
      text.includes('monitor') ||
      text.includes('integrate') && (text.includes('into') || text.includes('the')) ||
      text.includes('add') && (
        text.includes('check') ||
        text.includes('validation') ||
        text.includes('logging') ||
        text.includes('documentation') ||
        text.includes('test') ||
        text.includes('explicit') ||
        text.includes('specific') ||
        text.includes('handling') ||
        text.includes('support') ||
        text.includes('targeted') ||
        text.includes('regression') ||
        text.includes('metrics') ||
        text.includes('warning') ||
        text.includes('prominent') ||
        text.includes('additional') ||
        text.includes('more tests') ||
        text.includes('security')
      ) ||
      // Configuration suggestions
      text.includes('adjust') ||
      text.includes('configure') ||
      text.includes('making') && text.includes('configurable') ||
      // Refactoring suggestions
      text.includes('refactor') ||
      text.includes('introduce') && (text.includes('enum') || text.includes('constant')) ||
      text.includes('extract') && (text.includes('method') || text.includes('class') || text.includes('separate')) ||
      text.includes('use a more') ||
      text.includes('using a more') ||
      text.includes('implement') && (text.includes('iterative') || text.includes('approach')) ||
      text.includes('recursive approach') && text.includes('performance') ||
      // Opinion-based characterizations
      text.includes('overly permissive') ||
      text.includes('overly restrictive') ||
      text.includes('overly aggressive') ||
      text.includes('too generous') ||
      text.includes('too strict') ||
      // Completeness/quality suggestions (not bugs)
      text.includes('incomplete') ||
      text.includes('lacks sufficient') ||
      text.includes('lacks') && text.includes('validation') ||
      text.includes('does not adequately') ||
      text.includes('not adequately') ||
      text.includes('missing') && text.includes('validation') && !this.isTrueSecurityIssue(finding) ||
      text.includes('missing') && text.includes('timeout') && text.includes('validation') ||
      text.includes('inconsistent') && !this.isTrueSecurityIssue(finding) ||
      text.includes('incorrect handling') && !text.includes('crash') ||
      text.includes('incomplete validation') ||
      // Potential issues (not actual bugs)
      text.includes('potential') && !text.includes('sql injection') && !text.includes('rce') ||
      text.includes('brittleness') ||
      text.includes('brittle') ||
      text.includes('tightly coupled') ||
      text.includes('genuine bugs') || // "can be genuine bugs" = uncertainty
      text.includes('genuine issues') ||
      text.includes('may occur') ||
      text.includes('could occur') ||
      text.includes('may lead to') ||
      text.includes('could lead to') ||
      // Review/analysis suggestions
      text.includes('review') && !text.includes('code review tool') ||
      text.includes('audit') ||
      text.includes('substantial diff') ||
      text.includes('comprehensive') && (text.includes('test') || text.includes('testing')) ||
      text.includes('investigate') ||
      text.includes('profile') ||
      text.includes('thorough') ||
      text.includes('write thorough') ||
      // Efficiency/performance suggestions (not bugs)
      text.includes('more efficient') ||
      text.includes('could be more') ||
      text.includes('more concise') ||
      text.includes('inefficient') && !text.includes('exponential') ||
      text.includes('potentially inefficient') ||
      text.includes('time-consuming') && !text.includes('will hang') ||
      // Implementation suggestions
      text.includes('explore using') ||
      text.includes('alternatively') ||
      text.includes('using a different approach') ||
      text.includes('using a more') ||
      // Documentation suggestions
      text.includes('document') && !text.includes('undocumented vulnerability')
    );
  }

  private isWorkflowSecurityFalsePositive(finding: Finding, diffContent: string): boolean {
    // Only apply to workflow files
    if (!finding.file.includes('.github/workflows/')) {
      return false;
    }

    const text = (finding.title + ' ' + finding.message).toLowerCase();

    // Check if it's about fork PR security/secrets
    const isForkSecurityFinding = (
      (text.includes('fork') && (text.includes('secret') || text.includes('pr'))) ||
      text.includes('pull request') && text.includes('secret')
    );

    if (isForkSecurityFinding) {
      // Check if the diff or file shows security checks are already in place
      // Even if not in diff, if finding is about general workflow security (not a new change),
      // it's likely a false positive since workflows are reviewed separately
      const hasForkSecurityCheck = (
        diffContent.includes('SECURITY VIOLATION') ||
        diffContent.includes('Fork PR has access to secrets') ||
        diffContent.includes('if [ -n "$OPENROUTER_API_KEY" ]') ||
        diffContent.includes('fork_pr_has_secrets') ||
        diffContent.includes('github.event.pull_request.head.repo.fork')
      );

      if (hasForkSecurityCheck) {
        logger.debug(`Workflow security already implemented: ${finding.title}`);
        return true;
      }

      // If finding is about general workflow configuration (not specific code change),
      // and the workflow file wasn't completely rewritten, it's likely a false positive
      const isGeneralConfigFinding = (
        text.includes('repository setting') ||
        text.includes('settings -> actions') ||
        text.includes('workflow relies on') ||
        text.includes('disable \'send secrets')
      );

      if (isGeneralConfigFinding) {
        logger.debug(`General workflow config finding, not specific to diff: ${finding.title}`);
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
   * Check for invalid or suspicious line numbers that will cause GitHub API errors
   */
  private hasInvalidLineNumber(finding: Finding): boolean {
    // No line number is OK (general file-level finding)
    if (finding.line === undefined || finding.line === null) {
      return false;
    }

    // Line 0 or negative is always invalid
    if (finding.line <= 0) {
      logger.debug(`Invalid line number ${finding.line} for ${finding.file}, filtering`);
      return true;
    }

    // Line 1 is suspicious when combined with very generic finding messages
    // These often indicate the LLM couldn't determine the actual line
    if (finding.line === 1) {
      const text = (finding.title + ' ' + finding.message).toLowerCase();
      const isVeryGenericFinding = (
        text.includes('entire file') ||
        text.includes('file lacks') ||
        (text.includes('class lacks') && !this.isTrueSecurityIssue(finding))
      );

      if (isVeryGenericFinding) {
        logger.debug(`Very generic line:1 finding for ${finding.file}, likely invalid, filtering`);
        return true;
      }

      // Line 1 on generated/built files is suspicious
      const isGeneratedFile = (
        finding.file.includes('dist/') ||
        finding.file.includes('build/') ||
        finding.file.includes('.min.')
      );

      if (isGeneratedFile) {
        logger.debug(`Line:1 on generated file ${finding.file}, likely invalid, filtering`);
        return true;
      }
    }

    return false;
  }

  /**
   * Remove duplicate findings that are essentially the same issue
   * Uses file + title similarity + semantic keywords to detect duplicates
   */
  private deduplicateFindings(findings: Finding[]): Finding[] {
    const seen = new Map<string, Finding>();

    for (const finding of findings) {
      // Create a dedup key from file + normalized title + semantic keywords
      const text = finding.title.toLowerCase();
      const normalizedTitle = text
        .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      // Extract semantic keywords for better grouping
      const keywords = this.extractSemanticKeywords(text);
      const semanticKey = keywords.sort().join('_');

      // Use semantic key if it has meaningful content, otherwise use normalized title
      const dedupKey = semanticKey || normalizedTitle;
      const key = `${finding.file}:${dedupKey}`;

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

  /**
   * Extract semantic keywords from finding title for better deduplication
   * Groups similar concepts like "fork pr security", "missing validation", etc.
   */
  private extractSemanticKeywords(text: string): string[] {
    const keywords: string[] = [];

    // Security patterns
    if (text.includes('fork') && (text.includes('pr') || text.includes('pull request')) && text.includes('secret')) {
      keywords.push('fork_pr_secret');
    }
    if (text.includes('sql') && text.includes('injection')) {
      keywords.push('sql_injection');
    }
    if (text.includes('xss') || (text.includes('cross') && text.includes('site'))) {
      keywords.push('xss');
    }

    // Validation patterns
    if (text.includes('missing') && text.includes('validation')) {
      keywords.push('missing_validation');
    }
    if (text.includes('missing') && text.includes('error') && text.includes('handling')) {
      keywords.push('missing_error_handling');
    }

    // Performance patterns
    if (text.includes('race') && text.includes('condition')) {
      keywords.push('race_condition');
    }
    if (text.includes('inefficient') || text.includes('performance')) {
      keywords.push('performance');
    }

    // Test patterns
    if (text.includes('missing') && text.includes('test')) {
      keywords.push('missing_test');
    }

    return keywords;
  }

  private isAboutAddedFileFalsePositive(finding: Finding): boolean {
    const text = (finding.title + ' ' + finding.message).toLowerCase();

    // Complaints about new files not having tests visible in the diff
    if (text.includes('added without') && text.includes('test')) {
      return true;
    }
    if (text.includes('without visible test')) {
      return true;
    }

    return false;
  }

  private isSubjectiveCodeOpinion(finding: Finding): boolean {
    const text = (finding.title + ' ' + finding.message).toLowerCase();

    return (
      // Complexity/readability complaints (subjective)
      (text.includes('complex') && text.includes('difficult to read')) ||
      (text.includes('complexity') && !text.includes('exponential') && !text.includes('o(n')) ||
      text.includes('readability') ||
      // Code structure opinions
      text.includes('should be broken down') ||
      text.includes('should be split') ||
      text.includes('consider using an enum') ||
      text.includes('consider using constants') ||
      text.includes('magic strings') ||
      text.includes('refactor') && !text.includes('refactor to fix') ||
      text.includes('substantial diff') ||
      text.includes('significant logic changes') ||
      text.includes('review') && text.includes('algorithm changes') ||
      text.includes('review') && text.includes('implications') ||
      // Path normalization suggestions (not bugs)
      (text.includes('path normalization') && !text.includes('security')) ||
      (text.includes('inconsistent') && text.includes('path') && !text.includes('vulnerability')) ||
      // Documentation/commenting suggestions
      (text.includes('add tests') && !text.includes('untested')) ||
      text.includes('add unit test') ||
      text.includes('add regression test') ||
      text.includes('document') && text.includes('policy')
    );
  }

  private isCodeQualityIssue(finding: Finding): boolean {
    const text = (finding.title + ' ' + finding.message).toLowerCase();

    return (
      // Input validation (unless security-related)
      (text.includes('missing') && text.includes('validation') && !this.isTrueSecurityIssue(finding)) ||
      (text.includes('missing') && text.includes('input validation') && !this.isTrueSecurityIssue(finding)) ||
      (text.includes('missing') && text.includes('error handling') && !text.includes('crash')) ||
      (text.includes('missing') && text.includes('type safety') && !this.isTrueSecurityIssue(finding)) ||
      (text.includes('missing') && text.includes('runtime') && !this.isTrueSecurityIssue(finding)) ||
      (text.includes('lacks') && text.includes('validation')) ||
      text.includes('inconsistent') && text.includes('error handling') ||
      text.includes('inconsistency') && !this.isTrueSecurityIssue(finding) ||
      // Hard-coded values
      text.includes('hard-coded') ||
      text.includes('hardcoded') ||
      // Inefficiency (unless extreme)
      (text.includes('inefficient') && !text.includes('exponential')) ||
      text.includes('performance issue') ||
      text.includes('potential performance') ||
      // Monolithic / structure
      text.includes('monolithic') ||
      text.includes('complexity') ||
      text.includes('cyclomatic') ||
      text.includes('readability') ||
      text.includes('code complexity') ||
      text.includes('excessive') ||
      text.includes('duplication') ||
      text.includes('duplicate') ||
      text.includes('conditional statements') ||
      text.includes('conditional logic') ||
      text.includes('flaky test') ||
      text.includes('race condition') && !text.includes('crash') && !this.isTrueSecurityIssue(finding) ||
      text.includes('timing') && (text.includes('assumption') || text.includes('dependent')) ||
      // Comments
      text.includes('comment') ||
      text.includes('documentation') ||
      // Pattern validation complaints (TypeScript/library already validates)
      (text.includes('insecure') && text.includes('pattern validation')) ||
      (text.includes('pattern') && text.includes('not properly validate')) ||
      (text.includes('unsafe') && text.includes('glob pattern')) ||
      // Path handling (unless security)
      (text.includes('path normalization') && !text.includes('vulnerability')) ||
      (text.includes('path') && text.includes('consistency') && !text.includes('vulnerability')) ||
      (text.includes('path quoting') && !text.includes('vulnerability')) ||
      (text.includes('quoting') && text.includes('not fully handled')) ||
      // Serialization/deserialization implementation
      text.includes('circular reference') && text.includes('serialization') ||
      text.includes('deep clone') && text.includes('independence') ||
      // Rate limiting / error handling implementation details
      text.includes('rate limit handling') && !text.includes('bypass') ||
      text.includes('health check implementation') && !text.includes('fail') ||
      text.includes('handling 402') || // Payment errors are expected
      text.includes('payment required not handled') ||
      text.includes('lightweight healthcheck') ||
      text.includes('introduce lightweight') ||
      // Concurrency/synchronization (unless actual crash)
      text.includes('concurrency') && !text.includes('crash') ||
      text.includes('synchronization') && !text.includes('crash') ||
      text.includes('atomic operation') ||
      text.includes('mutex') ||
      text.includes('cleanup') && text.includes('timeout') && !text.includes('memory leak') ||
      text.includes('cancellation') && !text.includes('crash') ||
      // Timeout/cleanup implementation details
      text.includes('timeout') && text.includes('validation') && text.includes('missing') ||
      text.includes('timeout') && text.includes('configurable') ||
      text.includes('timeout handling') ||
      text.includes('timeout value') ||
      text.includes('promise') && text.includes('leak') && text.includes('potential') ||
      text.includes('doesn\'t clean up properly') ||
      // Batch validation (implementation detail)
      text.includes('batch size validation') ||
      text.includes('token-aware batching') ||
      text.includes('batch override') ||
      text.includes('provider batch override') ||
      text.includes('clamping behavior') ||
      // Model selection (not a bug)
      text.includes('model ranking') ||
      text.includes('model selection') ||
      // Completeness suggestions (not bugs)
      text.includes('incomplete') && !this.isTrueSecurityIssue(finding) ||
      text.includes('not handled') && !this.isTrueSecurityIssue(finding) ||
      text.includes('lacks sufficient validation') && !this.isTrueSecurityIssue(finding) ||
      text.includes('could be more efficient') ||
      text.includes('more efficient') && !text.includes('must') ||
      // Implementation changes (not bugs)
      text.includes('api change') ||
      text.includes('graph builder changes') ||
      text.includes('cache versioning') ||
      text.includes('new graphcache') ||
      text.includes('diff excerpt truncated') ||
      text.includes('normalized paths') ||
      text.includes('use normalized') ||
      text.includes('circular graphs') ||
      text.includes('deep copying') ||
      text.includes('security hardening') ||
      text.includes('aggressive pattern validation')
    );
  }
}
