import { FileChange } from '../types';
import { logger } from '../utils/logger';
import { isValidRegexPattern } from '../utils/regex-validator';

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
        if (!isValidRegexPattern(pattern)) {
          logger.warn(`Invalid trivial pattern "${pattern}": treating as literal string`);
          return filename.includes(pattern);
        }

        const regex = new RegExp(pattern);
        return regex.test(filename);
      } catch (error) {
        // Invalid regex, treat as literal string match
        logger.warn(`Failed to compile regex pattern "${pattern}": ${(error as Error).message}`);
        return filename.includes(pattern);
      }
    });
  }

  /**
   * Check if changes are formatting-only (whitespace, indentation, etc.)
   * Improved algorithm to reduce false positives:
   * 1. Checks if only whitespace differs between lines
   * 2. Uses ordered comparison to detect semantic changes
   * 3. Detects common semantic changes (identifiers, strings, imports)
   * 4. Validates that changes are truly formatting-related
   */
  private isFormattingOnly(file: FileChange): boolean {
    if (!file.patch) return false;

    // Extract added/removed lines from patch
    const lines = file.patch.split('\n');
    const changes = lines.filter(line => line.startsWith('+') || line.startsWith('-'));

    // Filter out diff metadata headers with strict pattern matching
    // Only exclude lines that are diff metadata (not code that happens to start with +++/---)
    const actualChanges = changes.filter(line => {
      // Exclude diff file headers: "+++ " or "--- " (with space after)
      if (/^(\+\+\+ |\-\-\- )/.test(line)) return false;
      // Exclude hunk headers: "@@ ... @@"
      if (/^@@/.test(line)) return false;
      return true;
    });

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

      // Additional semantic checks - catch changes that normalized comparison might miss
      if (!this.areSemanticallySame(added, deleted)) {
        return false;
      }
    }

    // All lines differ only in whitespace
    return true;
  }

  /**
   * Check if two lines are semantically the same (beyond whitespace)
   * Detects common semantic changes like:
   * - Variable/function name changes
   * - String literal changes
   * - Number literal changes
   * - Import/export changes
   */
  private areSemanticallySame(line1: string, line2: string): boolean {
    const trimmed1 = line1.trim();
    const trimmed2 = line2.trim();

    // If both are empty or comments, they're the same
    if (!trimmed1 && !trimmed2) return true;
    if (trimmed1.startsWith('//') && trimmed2.startsWith('//')) return true;
    if (trimmed1.startsWith('/*') && trimmed2.startsWith('/*')) return true;
    if (trimmed1.startsWith('*') && trimmed2.startsWith('*')) return true;

    // Extract identifiers (variable/function names)
    const identifiers1 = this.extractIdentifiers(trimmed1);
    const identifiers2 = this.extractIdentifiers(trimmed2);

    // If identifier count differs, it's a semantic change
    if (identifiers1.length !== identifiers2.length) return false;

    // If any identifier changed (ignoring order for now), it's semantic
    const ids1Set = new Set(identifiers1);
    const ids2Set = new Set(identifiers2);
    if (ids1Set.size !== ids2Set.size) return false;
    for (const id of ids1Set) {
      if (!ids2Set.has(id)) return false;
    }

    // Extract string literals
    const strings1 = this.extractStrings(trimmed1);
    const strings2 = this.extractStrings(trimmed2);

    // If string literal changed, it's semantic
    if (strings1.join('|') !== strings2.join('|')) return false;

    // Check for import/export changes
    if (this.isImportOrExport(trimmed1) || this.isImportOrExport(trimmed2)) {
      // For imports/exports, require exact match (after normalization)
      return this.normalizeWhitespace(trimmed1) === this.normalizeWhitespace(trimmed2);
    }

    return true;
  }

  /**
   * Extract identifiers (variable/function names) from a line of code
   */
  private extractIdentifiers(line: string): string[] {
    // Simple identifier extraction (words that look like identifiers)
    const matches = line.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g);
    return matches || [];
  }

  /**
   * Extract string literals from a line of code
   */
  private extractStrings(line: string): string[] {
    const strings: string[] = [];
    // Match single and double quoted strings
    const singleQuoted = line.match(/'([^']*)'/g);
    const doubleQuoted = line.match(/"([^"]*)"/g);
    const templateLiteral = line.match(/`([^`]*)`/g);

    if (singleQuoted) strings.push(...singleQuoted);
    if (doubleQuoted) strings.push(...doubleQuoted);
    if (templateLiteral) strings.push(...templateLiteral);

    return strings;
  }

  /**
   * Check if a line is an import or export statement
   */
  private isImportOrExport(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('import ') ||
           trimmed.startsWith('export ') ||
           trimmed.startsWith('from ') ||
           trimmed.includes('require(');
  }

  /**
   * Normalize whitespace for comparison
   * Trims and collapses internal whitespace runs to single space
   * This preserves string literals and semantics while detecting formatting changes
   */
  private normalizeWhitespace(text: string): string {
    // Trim leading/trailing whitespace and collapse internal runs to single space
    return text.trim().replace(/\s+/g, ' ');
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
