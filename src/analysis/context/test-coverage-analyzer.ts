/**
 * Test Coverage Analyzer - Reduces false positives by detecting test coverage
 *
 * Auto-detects:
 * - Which functions/methods have test coverage
 * - Which edge cases are tested (null handling, error cases, etc.)
 * - Test files that exercise specific code paths
 *
 * Helps reviewers avoid flagging well-tested code as potentially buggy.
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface TestCoverageInfo {
  testedFunctions: Set<string>;
  testedFiles: Set<string>;
  edgeCaseTests: {
    nullHandling: string[];
    errorHandling: string[];
    boundaryConditions: string[];
    concurrency: string[];
  };
  testFileMapping: Map<string, string[]>; // source file -> test files
}

/**
 * Analyzes test files to understand what's tested
 * Reduces false positives by recognizing tested code
 */
export class TestCoverageAnalyzer {
  /**
   * Scan test files to build coverage map
   */
  async analyzeTestCoverage(projectRoot: string): Promise<TestCoverageInfo> {
    const testedFunctions = new Set<string>();
    const testedFiles = new Set<string>();
    const testFileMapping = new Map<string, string[]>();
    const edgeCaseTests = {
      nullHandling: [] as string[],
      errorHandling: [] as string[],
      boundaryConditions: [] as string[],
      concurrency: [] as string[],
    };

    try {
      // Find all test files
      const testFiles = await this.findTestFiles(projectRoot);

      for (const testFile of testFiles) {
        const content = await fs.readFile(testFile, 'utf-8');

        // Extract tested source file from imports
        const sourceFiles = this.extractSourceFileReferences(content, testFile, projectRoot);
        for (const sourceFile of sourceFiles) {
          const existing = testFileMapping.get(sourceFile) || [];
          existing.push(testFile);
          testFileMapping.set(sourceFile, existing);
          testedFiles.add(sourceFile);
        }

        // Extract tested functions from test descriptions
        const functions = this.extractTestedFunctions(content);
        functions.forEach(f => testedFunctions.add(f));

        // Detect edge case tests
        if (/null|undefined/i.test(content)) {
          edgeCaseTests.nullHandling.push(testFile);
        }
        if (/error|throw|reject|catch/i.test(content)) {
          edgeCaseTests.errorHandling.push(testFile);
        }
        if (/boundary|edge|limit|min|max/i.test(content)) {
          edgeCaseTests.boundaryConditions.push(testFile);
        }
        if (/concurrent|parallel|race|deadlock/i.test(content)) {
          edgeCaseTests.concurrency.push(testFile);
        }
      }
    } catch (error) {
      // If we can't analyze tests, return empty coverage (no false negatives)
      console.warn('Failed to analyze test coverage:', error);
    }

    return {
      testedFunctions,
      testedFiles,
      edgeCaseTests,
      testFileMapping,
    };
  }

  private async findTestFiles(projectRoot: string): Promise<string[]> {
    const testFiles: string[] = [];
    const testDirs = ['__tests__', 'test', 'tests', 'spec'];

    for (const dir of testDirs) {
      const testDir = path.join(projectRoot, dir);
      try {
        await fs.access(testDir);
        const files = await this.walkDirectory(testDir);
        testFiles.push(...files.filter(f => /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(f)));
      } catch {
        // Directory doesn't exist, skip
      }
    }

    return testFiles;
  }

  private async walkDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...(await this.walkDirectory(fullPath)));
        } else {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore errors
    }
    return files;
  }

  private extractSourceFileReferences(content: string, testFile: string, _projectRoot: string): string[] {
    const sourceFiles: string[] = [];

    // Match import/require statements
    const importRegex = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];

      // Skip node_modules and test utilities
      if (importPath.startsWith('.') && !importPath.includes('test') && !importPath.includes('mock')) {
        // Resolve relative import to absolute path
        const testDir = path.dirname(testFile);
        const resolved = path.resolve(testDir, importPath);

        // Try common extensions
        for (const ext of ['.ts', '.tsx', '.js', '.jsx', '']) {
          const withExt = ext ? `${resolved}${ext}` : resolved;
          sourceFiles.push(withExt);
        }
      }
    }

    return sourceFiles;
  }

  private extractTestedFunctions(content: string): string[] {
    const functions: string[] = [];

    // Match test descriptions that mention function names
    const testDescRegex = /(?:test|it|describe)\s*\(\s*['"]([^'"]+)['"]/g;
    let match;

    while ((match = testDescRegex.exec(content)) !== null) {
      const description = match[1];

      // Extract function/method names from descriptions like "foo() should..." or "test foo"
      const functionMatch = description.match(/(\w+)\s*\(\)/);
      if (functionMatch) {
        functions.push(functionMatch[1]);
      }
    }

    return functions;
  }

  /**
   * Generate prompt context about test coverage
   */
  generatePromptContext(coverage: TestCoverageInfo, fileUnderReview: string): string {
    const testFiles = coverage.testFileMapping.get(fileUnderReview) || [];

    if (testFiles.length === 0) {
      return '\n## Test Coverage: No automated tests found for this file\n' +
             '**Reviewer Note**: Higher scrutiny recommended for untested code.\n';
    }

    const parts: string[] = [
      '\n## Test Coverage (Auto-Detected)',
      `This file has ${testFiles.length} test file(s) with automated coverage:`,
    ];

    for (const testFile of testFiles.slice(0, 3)) {
      const basename = path.basename(testFile);
      parts.push(`- ${basename}`);
    }

    const edgeCaseCoverage: string[] = [];
    if (testFiles.some(f => coverage.edgeCaseTests.nullHandling.includes(f))) {
      edgeCaseCoverage.push('null/undefined handling');
    }
    if (testFiles.some(f => coverage.edgeCaseTests.errorHandling.includes(f))) {
      edgeCaseCoverage.push('error cases');
    }
    if (testFiles.some(f => coverage.edgeCaseTests.boundaryConditions.includes(f))) {
      edgeCaseCoverage.push('boundary conditions');
    }
    if (testFiles.some(f => coverage.edgeCaseTests.concurrency.includes(f))) {
      edgeCaseCoverage.push('concurrency scenarios');
    }

    if (edgeCaseCoverage.length > 0) {
      parts.push(`\n**Edge Cases Tested**: ${edgeCaseCoverage.join(', ')}`);
    }

    parts.push(
      '\n**Reviewer Note**: This code has test coverage. Before flagging issues, check if tests validate the behavior.'
    );

    return parts.join('\n');
  }

  /**
   * Check if a function has test coverage
   */
  hasFunctionCoverage(coverage: TestCoverageInfo, functionName: string): boolean {
    return coverage.testedFunctions.has(functionName);
  }

  /**
   * Check if a file has test coverage
   */
  hasFileCoverage(coverage: TestCoverageInfo, filePath: string): boolean {
    return coverage.testedFiles.has(filePath) || coverage.testFileMapping.has(filePath);
  }
}
