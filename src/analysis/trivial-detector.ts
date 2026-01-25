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
  skipBuildArtifacts: boolean;
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
    'pdm.lock',
    'Pipfile.lock',
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
    /\.gitattributes$/,
    /tsconfig\.json$/,
    /jsconfig\.json$/,
    /\.vscode\//,
    /\.idea\//,
  ];

  // Build artifacts and generated files
  private readonly BUILD_ARTIFACT_PATTERNS = [
    /^dist\//,
    /^build\//,
    /^out\//,
    /^\.next\//,
    /^\.nuxt\//,
    /^target\//,  // Rust/Java
    /^bin\//,
    /^obj\//,
    /\.min\.js$/,
    /\.min\.css$/,
    /\.map$/,     // Source maps
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

    // Build artifacts
    if (this.config.skipBuildArtifacts && this.isBuildArtifact(filename)) {
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
   * Check if file is a build artifact
   */
  private isBuildArtifact(filename: string): boolean {
    return this.BUILD_ARTIFACT_PATTERNS.some(pattern => pattern.test(filename));
  }

  /**
   * Check if file matches custom trivial patterns
   */
  private matchesCustomPattern(filename: string): boolean {
    return this.config.customTrivialPatterns.some(pattern => {
      try {
        // Validate pattern to prevent regex injection and ReDoS
        if (!this.isValidRegexPattern(pattern)) {
          console.warn(`Invalid trivial pattern "${pattern}": treating as literal string`);
          return filename.includes(pattern);
        }

        const regex = new RegExp(pattern);
        return regex.test(filename);
      } catch (error) {
        // Invalid regex, treat as literal string match
        console.warn(`Failed to compile regex pattern "${pattern}": ${(error as Error).message}`);
        return filename.includes(pattern);
      }
    });
  }

  /**
   * Validate regex pattern to prevent ReDoS attacks
   */
  private isValidRegexPattern(pattern: string): boolean {
    // Check for empty or non-string patterns
    if (!pattern || typeof pattern !== 'string') {
      return false;
    }

    // Limit pattern length to prevent complexity attacks
    if (pattern.length > 500) {
      return false;
    }

    // Check for suspicious patterns that could cause ReDoS
    const suspiciousPatterns = [
      /(\*\*){3,}/, // Multiple consecutive **
      /(\+\+){3,}/, // Multiple consecutive ++
      /(\*){10,}/, // Too many consecutive *
      /(\+){10,}/, // Too many consecutive +
      /(.)\1{20,}/, // Excessive character repetition
      /(\.\*){5,}/, // Too many .* patterns
    ];

    for (const suspicious of suspiciousPatterns) {
      if (suspicious.test(pattern)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if changes are formatting-only (whitespace, indentation, etc.)
   * Improved algorithm to reduce false positives:
   * 1. Checks if only whitespace differs between lines
   * 2. Uses ordered comparison to detect semantic changes
   * 3. Validates that changes are truly formatting-related
   */
  private isFormattingOnly(file: FileChange): boolean {
    if (!file.patch) return false;

    // Extract added/removed lines from patch
    const lines = file.patch.split('\n');
    const changes = lines.filter(line => line.startsWith('+') || line.startsWith('-'));
    const actualChanges = changes.filter(line => !line.startsWith('+++') && !line.startsWith('---'));

    if (actualChanges.length === 0) return true;

    // Separate additions and deletions
    const additions = actualChanges.filter(line => line.startsWith('+')).map(line => line.substring(1));
    const deletions = actualChanges.filter(line => line.startsWith('-')).map(line => line.substring(1));

    // If different number of additions vs deletions, not just formatting
    if (additions.length !== deletions.length) return false;

    // Check each pair of lines to see if they differ only in whitespace
    for (let i = 0; i < additions.length; i++) {
      const added = additions[i];
      const deleted = deletions[i];

      // Get normalized versions (remove all whitespace)
      const normalizedAdded = this.normalizeWhitespace(added);
      const normalizedDeleted = this.normalizeWhitespace(deleted);

      // If normalized content differs, this is not just formatting
      if (normalizedAdded !== normalizedDeleted) {
        // Additional check: allow completely empty lines to be added/removed
        if (normalizedAdded.length > 0 || normalizedDeleted.length > 0) {
          return false;
        }
      }
    }

    // All lines differ only in whitespace
    return true;
  }

  /**
   * Normalize whitespace for comparison
   * Removes all whitespace to detect semantic changes
   */
  private normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, '');
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
    const hasOnlyBuildArtifacts = files.every(f => this.isBuildArtifact(f.filename));

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

    if (hasOnlyBuildArtifacts) {
      reasons.push('build artifact updates only');
    }

    if (reasons.length === 0) {
      // Mixed trivial types
      const types = new Set<string>();
      files.forEach(f => {
        if (this.isDependencyLockFile(f.filename)) types.add('dependency locks');
        if (this.isDocumentationFile(f.filename)) types.add('documentation');
        if (this.isTestFixture(f.filename)) types.add('test fixtures');
        if (this.isConfigFile(f.filename)) types.add('config files');
        if (this.isBuildArtifact(f.filename)) types.add('build artifacts');
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
    skipFormattingOnly: false, // Disabled by default (may have false positives)
    skipTestFixtures: true,
    skipConfigFiles: true,
    skipBuildArtifacts: true,
    customTrivialPatterns: [],
  };
}
