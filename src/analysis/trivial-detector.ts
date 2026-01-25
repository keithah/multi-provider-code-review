import { FileChange } from '../types';
import { logger } from '../utils/logger';

/**
 * Detects trivial changes that don't require code review
 * Inspired by CodeRabbit's smart review skipping
 * Saves API costs and reduces noise for developers
 */

export interface TrivialDetectionResult {
  isTrivial: boolean;
  reason?: string;
  trivialFiles: string[];
  nonTrivialFiles: string[];
}

export interface TrivialDetectorConfig {
  enabled: boolean;
  skipDependencyUpdates: boolean;
  skipDocumentationOnly: boolean;
  skipFormattingOnly: boolean;
  skipTestFixtures: boolean;
  skipConfigFiles: boolean;
  customTrivialPatterns: string[];
}

export class TrivialDetector {
  private config: TrivialDetectorConfig;

  // Patterns for different types of trivial changes
  private readonly DEPENDENCY_FILES = [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'Gemfile.lock',
    'Cargo.lock',
    'poetry.lock',
    'go.sum',
    'composer.lock',
  ];

  private readonly DOCUMENTATION_PATTERNS = [
    /\.md$/i,
    /^docs?\//i,
    /README/i,
    /CHANGELOG/i,
    /LICENSE/i,
    /CONTRIBUTING/i,
  ];

  private readonly TEST_FIXTURE_PATTERNS = [
    /__fixtures__\//,
    /__snapshots__\//,
    /__mocks__\//,
    /\.snap$/,
    /fixtures?\//i,
    /test-data\//i,
    /mock-data\//i,
  ];

  private readonly CONFIG_FILE_PATTERNS = [
    /\.eslintrc/,
    /\.prettierrc/,
    /\.editorconfig/,
    /\.gitignore/,
    /\.npmignore/,
    /\.dockerignore/,
    /tsconfig\.json$/,
    /jsconfig\.json$/,
    /\.vscode\//,
    /\.idea\//,
  ];

  constructor(config: TrivialDetectorConfig) {
    this.config = config;
  }

  /**
   * Analyze PR files to determine if the change is trivial
   */
  detect(files: FileChange[]): TrivialDetectionResult {
    if (!this.config.enabled) {
      return {
        isTrivial: false,
        trivialFiles: [],
        nonTrivialFiles: files.map(f => f.filename),
      };
    }

    const trivialFiles: string[] = [];
    const nonTrivialFiles: string[] = [];

    // Categorize each file
    for (const file of files) {
      if (this.isFileTrivial(file)) {
        trivialFiles.push(file.filename);
      } else {
        nonTrivialFiles.push(file.filename);
      }
    }

    // Determine if entire PR is trivial
    const isTrivial = nonTrivialFiles.length === 0 && trivialFiles.length > 0;

    if (isTrivial) {
      const reason = this.getTrivialReason(files);
      logger.info(`Skipping review: ${reason}`);
      return { isTrivial: true, reason, trivialFiles, nonTrivialFiles: [] };
    }

    // Log partial trivial detection
    if (trivialFiles.length > 0) {
      logger.info(`${trivialFiles.length} trivial file(s) will be excluded from review`, {
        trivial: trivialFiles,
        reviewing: nonTrivialFiles.length,
      });
    }

    return { isTrivial: false, trivialFiles, nonTrivialFiles };
  }

  /**
   * Check if a single file is trivial
   */
  private isFileTrivial(file: FileChange): boolean {
    const filename = file.filename;

    // Dependency lock files
    if (this.config.skipDependencyUpdates && this.isDependencyLockFile(filename)) {
      return true;
    }

    // Documentation files
    if (this.config.skipDocumentationOnly && this.isDocumentationFile(filename)) {
      return true;
    }

    // Test fixtures
    if (this.config.skipTestFixtures && this.isTestFixture(filename)) {
      return true;
    }

    // Config files
    if (this.config.skipConfigFiles && this.isConfigFile(filename)) {
      return true;
    }

    // Custom patterns
    if (this.matchesCustomPattern(filename)) {
      return true;
    }

    // Formatting-only changes (requires patch analysis)
    if (this.config.skipFormattingOnly && file.patch && this.isFormattingOnly(file)) {
      return true;
    }

    return false;
  }

  /**
   * Check if file is a dependency lock file
   */
  private isDependencyLockFile(filename: string): boolean {
    const basename = filename.split('/').pop() || '';
    return this.DEPENDENCY_FILES.includes(basename);
  }

  /**
   * Check if file is documentation
   */
  private isDocumentationFile(filename: string): boolean {
    return this.DOCUMENTATION_PATTERNS.some(pattern => pattern.test(filename));
  }

  /**
   * Check if file is a test fixture
   */
  private isTestFixture(filename: string): boolean {
    return this.TEST_FIXTURE_PATTERNS.some(pattern => pattern.test(filename));
  }

  /**
   * Check if file is a config file
   */
  private isConfigFile(filename: string): boolean {
    return this.CONFIG_FILE_PATTERNS.some(pattern => pattern.test(filename));
  }

  /**
   * Check if file matches custom trivial patterns
   */
  private matchesCustomPattern(filename: string): boolean {
    return this.config.customTrivialPatterns.some(pattern => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(filename);
      } catch {
        // Invalid regex, treat as literal string match
        return filename.includes(pattern);
      }
    });
  }

  /**
   * Check if changes are formatting-only (whitespace, indentation, etc.)
   */
  private isFormattingOnly(file: FileChange): boolean {
    if (!file.patch) return false;

    // Extract added/removed lines from patch
    const lines = file.patch.split('\n');
    const changes = lines.filter(line => line.startsWith('+') || line.startsWith('-'));
    const actualChanges = changes.filter(line => !line.startsWith('+++') && !line.startsWith('---'));

    if (actualChanges.length === 0) return true;

    // Check if all changes are whitespace-only
    const hasSubstantiveChanges = actualChanges.some(line => {
      // Remove +/- prefix
      const content = line.substring(1);
      // Remove whitespace
      const trimmed = content.trim();

      // If trimmed content exists, check if it's different from just whitespace changes
      if (trimmed.length === 0) return false; // Empty line, not substantive

      // Look for actual code changes (not just whitespace/formatting)
      // This is a simple heuristic - could be improved
      return trimmed.length > 0;
    });

    // If no substantive changes found, it's formatting-only
    return !hasSubstantiveChanges;
  }

  /**
   * Generate a human-readable reason for why PR is trivial
   */
  private getTrivialReason(files: FileChange[]): string {
    const reasons: string[] = [];

    const hasOnlyDeps = files.every(f => this.isDependencyLockFile(f.filename));
    const hasOnlyDocs = files.every(f => this.isDocumentationFile(f.filename));
    const hasOnlyFixtures = files.every(f => this.isTestFixture(f.filename));
    const hasOnlyConfig = files.every(f => this.isConfigFile(f.filename));

    if (hasOnlyDeps) {
      reasons.push('dependency lock file updates only');
    }

    if (hasOnlyDocs) {
      reasons.push('documentation changes only');
    }

    if (hasOnlyFixtures) {
      reasons.push('test fixture updates only');
    }

    if (hasOnlyConfig) {
      reasons.push('configuration file changes only');
    }

    if (reasons.length === 0) {
      // Mixed trivial types
      const types = new Set<string>();
      files.forEach(f => {
        if (this.isDependencyLockFile(f.filename)) types.add('dependency locks');
        if (this.isDocumentationFile(f.filename)) types.add('documentation');
        if (this.isTestFixture(f.filename)) types.add('test fixtures');
        if (this.isConfigFile(f.filename)) types.add('config files');
      });

      if (types.size > 0) {
        return `trivial changes only (${Array.from(types).join(', ')})`;
      }

      return 'trivial changes detected';
    }

    return reasons.join(', ');
  }

  /**
   * Filter out trivial files from a file list
   */
  filterNonTrivial(files: FileChange[]): FileChange[] {
    const result = this.detect(files);
    return files.filter(f => result.nonTrivialFiles.includes(f.filename));
  }
}

/**
 * Create default trivial detector configuration
 */
export function createDefaultTrivialConfig(): TrivialDetectorConfig {
  return {
    enabled: true,
    skipDependencyUpdates: true,
    skipDocumentationOnly: true,
    skipFormattingOnly: false, // Disabled by default (hard to detect accurately)
    skipTestFixtures: true,
    skipConfigFiles: true,
    customTrivialPatterns: [],
  };
}
