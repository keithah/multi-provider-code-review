import { FileChange, CodeSnippet, ImpactAnalysis } from '../../types';
import { logger } from '../../utils/logger';
import * as path from 'path';
import type TreeSitter from 'tree-sitter';

// Type aliases for tree-sitter types (modules are lazy-loaded to avoid bundling native code)
type Parser = TreeSitter;
type SyntaxNode = TreeSitter.SyntaxNode;

/**
 * Normalize a module specifier to a canonical file path
 * Resolves relative imports (./foo, ../bar) relative to the importer
 */
function resolveImportPath(importerFile: string, moduleSpecifier: string): string {
  // If it's a relative import (starts with . or ..)
  if (moduleSpecifier.startsWith('.')) {
    const importerDir = path.dirname(importerFile);
    // Only resolve to absolute if importer has a directory component
    // This prevents test files like 'component.ts' from becoming absolute
    if (importerDir && importerDir !== '.' && importerDir !== importerFile) {
      const resolved = path.join(importerDir, moduleSpecifier);
      // Normalize to forward slashes for consistency
      return resolved.replace(/\\/g, '/');
    }
  }
  // For package imports (e.g., 'react', '@types/node') or simple relative paths, return as-is
  return moduleSpecifier;
}

export interface Definition {
  name: string;
  file: string;
  line: number;
  type: 'function' | 'class' | 'variable' | 'type' | 'interface';
  exported: boolean;
}

export interface ImportInfo {
  source: string;
  imported: string[];
  file: string;
  line: number;
}

export interface CallInfo {
  caller: string;
  callee: string;
  file: string;
  line: number;
}

export interface GraphCodeSnippet {
  file: string;
  line: number;
  code: string;
  context?: string;
}

/**
 * Type for serialized graph data (must match CodeGraph.serialize() return type)
 */
export interface SerializedGraph {
  files: string[];
  buildTime: number;
  definitions: Array<[string, Definition]>;
  imports: Array<[string, string[]]>;
  exports: Array<[string, string[]]>;
  calls: Array<[string, string[]]>;
  callers: Array<[string, string[]]>;
  fileSymbols: Array<[string, string[]]>;
}

/**
 * AST-based code graph that tracks:
 * - Symbol definitions (functions, classes, variables)
 * - Import/export relationships
 * - Function calls
 * - Class inheritance
 *
 * Enables O(1) lookups for "who uses this?" queries.
 */
export class CodeGraph {
  private definitions = new Map<string, Definition>();
  private imports = new Map<string, string[]>(); // file → imported files
  private exports = new Map<string, string[]>(); // file → exported symbols
  private calls = new Map<string, string[]>(); // fn → called fns
  private callers = new Map<string, string[]>(); // fn → callers
  private fileSymbols = new Map<string, string[]>(); // file → symbols defined

  constructor(
    public readonly files: string[] = [],
    public readonly buildTime: number = 0
  ) {}

  /**
   * Add a definition to the graph
   */
  addDefinition(def: Definition): void {
    const key = `${def.file}:${def.name}`;
    this.definitions.set(key, def);

    // Track file → symbols
    const symbols = this.fileSymbols.get(def.file) || [];
    symbols.push(def.name);
    this.fileSymbols.set(def.file, symbols);
  }

  /**
   * Remove all data for a file from the graph
   * Used when re-analyzing a file to avoid stale data
   */
  /**
   * Remove a file and all its relationships from the graph
   *
   * PERFORMANCE: Optimized to O(E) where E is the number of edges,
   * using Sets for O(1) lookups instead of O(n) array filtering.
   *
   * CORRECTNESS: Ensures complete cleanup of:
   * - Definitions (from fileSymbols and definitions map)
   * - Imports and exports
   * - Call edges (both directions: calls and callers)
   * - Non-definition symbols (e.g., <top>, anonymous functions)
   */
  removeFile(file: string): void {
    // Phase 1: Build Set of all symbols to remove for O(1) lookup
    // Includes both definitions and non-definitions (e.g., <top>)
    const symbolNames = this.fileSymbols.get(file) || [];
    const filePrefix = `${file}:`;
    const symbolsToRemove = new Set<string>();

    // Add known definitions
    for (const name of symbolNames) {
      symbolsToRemove.add(`${file}:${name}`);
    }

    // Add non-definition call edges (scan both calls and callers maps)
    for (const [caller] of this.calls) {
      if (caller.startsWith(filePrefix)) {
        symbolsToRemove.add(caller);
      }
    }
    for (const [callee] of this.callers) {
      if (callee.startsWith(filePrefix)) {
        symbolsToRemove.add(callee);
      }
    }

    // Phase 2: Remove simple entries (no edge cleanup needed)
    this.fileSymbols.delete(file);
    this.imports.delete(file);
    this.exports.delete(file);

    for (const symbol of symbolsToRemove) {
      this.definitions.delete(symbol);
    }

    // Phase 3: Clean up call edges (bidirectional graph)
    // Use Set-based filtering for O(1) lookup per element instead of O(n)
    for (const symbol of symbolsToRemove) {
      // Clean up outgoing calls: remove symbol from callers lists of callees
      const callees = this.calls.get(symbol);
      if (callees) {
        for (const callee of callees) {
          const callerList = this.callers.get(callee);
          if (callerList) {
            const filtered = callerList.filter(c => !symbolsToRemove.has(c));
            if (filtered.length > 0) {
              this.callers.set(callee, filtered);
            } else {
              this.callers.delete(callee);
            }
          }
        }
      }

      // Clean up incoming calls: remove symbol from calls lists of callers
      const callersToThis = this.callers.get(symbol);
      if (callersToThis) {
        for (const caller of callersToThis) {
          const calleeList = this.calls.get(caller);
          if (calleeList) {
            const filtered = calleeList.filter(c => !symbolsToRemove.has(c));
            if (filtered.length > 0) {
              this.calls.set(caller, filtered);
            } else {
              this.calls.delete(caller);
            }
          }
        }
      }

      // Remove symbol's own entries from maps
      this.calls.delete(symbol);
      this.callers.delete(symbol);
    }
  }

  /**
   * Add an import relationship
   */
  addImport(fromFile: string, toFile: string): void {
    // Normalize the import path to canonical form
    const normalizedPath = resolveImportPath(fromFile, toFile);
    const imported = this.imports.get(fromFile) || [];
    if (!imported.includes(normalizedPath)) {
      imported.push(normalizedPath);
      this.imports.set(fromFile, imported);
    }
  }

  /**
   * Add a call relationship
   */
  addCall(callerFile: string, caller: string, callee: string): void {
    // Use file-qualified keys to avoid symbol collisions across files
    const qualifiedCaller = `${callerFile}:${caller}`;
    // Qualify callee with caller file when we cannot resolve the target file to avoid collisions across files
    const qualifiedCallee = callee.includes(':') ? callee : `${callerFile}:${callee}`;

    // Track caller → callee
    const called = this.calls.get(qualifiedCaller) || [];
    if (!called.includes(qualifiedCallee)) {
      called.push(qualifiedCallee);
      this.calls.set(qualifiedCaller, called);
    }

    // Track callee → callers (reverse index)
    const callerList = this.callers.get(qualifiedCallee) || [];
    if (!callerList.includes(qualifiedCaller)) {
      callerList.push(qualifiedCaller);
      this.callers.set(qualifiedCallee, callerList);
    }
  }

  /**
   * Find all places where a symbol is called/used
   */
  findCallers(symbol: string): GraphCodeSnippet[] {
    // Support both qualified (file:symbol) and unqualified symbol lookups
    const candidateKeys = symbol.includes(':')
      ? [symbol]
      : Array.from(this.callers.keys()).filter(key => key.endsWith(`:${symbol}`));

    const callerList = candidateKeys.flatMap(key => this.callers.get(key) || []);
    const snippets: GraphCodeSnippet[] = [];

    for (const qualifiedCaller of callerList) {
      // qualifiedCaller is now in format "file:symbol"
      // Look it up directly in definitions
      const def = this.definitions.get(qualifiedCaller);
      if (def) {
        snippets.push({
          file: def.file,
          line: def.line,
          code: `${def.type} ${def.name}`,
          context: `Called from ${def.name}`,
        });
      }
    }

    return snippets;
  }

  /**
   * Normalize a file path for comparison (strips extensions, converts to posix)
   */
  private normalizePathForComparison(path: string): string {
    // Convert backslashes to forward slashes
    let normalized = path.replace(/\\/g, '/');
    // Strip common file extensions
    normalized = normalized.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');
    return normalized;
  }

  /**
   * Find all files that import/depend on a given file
   */
  findConsumers(file: string): GraphCodeSnippet[] {
    const consumers: GraphCodeSnippet[] = [];
    const normalizedFile = this.normalizePathForComparison(file);

    for (const [fromFile, toFiles] of this.imports) {
      // Check if any imported path matches (could be relative or absolute)
      const hasMatch = toFiles.some(importedPath => {
        const normalizedImport = this.normalizePathForComparison(importedPath);
        // Direct match with normalized path
        if (normalizedImport === normalizedFile) return true;
        // Also check if the resolved path ends with the file (for relative comparisons)
        if (normalizedImport.endsWith(normalizedFile)) return true;
        // Check if the file ends with the import (reverse check for extensionless imports)
        if (normalizedFile.endsWith(normalizedImport)) return true;
        return false;
      });

      if (hasMatch) {
        consumers.push({
          file: fromFile,
          line: 1,
          code: `import from '${file}'`,
          context: `File depends on ${file}`,
        });
      }
    }

    return consumers;
  }

  /**
   * Find all symbols defined in a file
   */
  getFileSymbols(file: string): Definition[] {
    const symbolNames = this.fileSymbols.get(file) || [];
    return symbolNames
      .map((name) => this.definitions.get(`${file}:${name}`))
      .filter((def): def is Definition => def !== undefined);
  }

  /**
   * Get a symbol definition by name (searches all files)
   */
  getDefinition(symbolName: string): Definition | undefined {
    for (const [, def] of this.definitions) {
      if (def.name === symbolName) {
        return def;
      }
    }
    return undefined;
  }

  /**
   * Get all files that a file depends on (direct imports)
   */
  getDependencies(file: string): string[] {
    return this.imports.get(file) || [];
  }

  /**
   * Get all files that depend on this file (reverse)
   */
  getDependents(file: string): string[] {
    const dependents: string[] = [];
    const normalizedFile = this.normalizePathForComparison(file);

    for (const [fromFile, toFiles] of this.imports) {
      // Check if any imported path matches (could be relative or absolute)
      const hasMatch = toFiles.some(importedPath => {
        const normalizedImport = this.normalizePathForComparison(importedPath);
        // Direct match with normalized path
        if (normalizedImport === normalizedFile) return true;
        // Also check if the resolved path ends with the file (for relative comparisons)
        if (normalizedImport.endsWith(normalizedFile)) return true;
        // Check if the file ends with the import (reverse check for extensionless imports)
        if (normalizedFile.endsWith(normalizedImport)) return true;
        return false;
      });

      if (hasMatch) {
        dependents.push(fromFile);
      }
    }
    return dependents;
  }

  /**
   * Find all symbols called by a given symbol (callees)
   * Required by CodeGraph interface
   */
  findCallees(symbol: string): CodeSnippet[] {
    const callees = this.calls.get(symbol) || [];
    return callees.map((callee) => ({
      filename: '',
      startLine: 0,
      endLine: 0,
      code: callee,
    }));
  }

  /**
   * Find all classes that inherit from a given class
   * Required by CodeGraph interface - currently a stub
   *
   * LIMITATION: Class inheritance tracking is not yet implemented.
   * This would require:
   * 1. Parsing extends/implements clauses in class declarations
   * 2. Building an inheritance graph alongside the import graph
   * 3. Resolving parent class names to their definitions
   *
   * Impact: Without this, code reviews may miss inheritance-related issues
   * where changes to a base class affect derived classes. Reviewers should
   * manually check for inheritance relationships when reviewing class changes.
   *
   * Tracked in issue #TODO
   */
  findDerivedClasses(_className: string): CodeSnippet[] {
    return [];
  }

  /**
   * Find all dependencies (imports) for a file
   * Required by CodeGraph interface - wraps getDependencies
   */
  findDependencies(file: string): CodeSnippet[] {
    const deps = this.getDependencies(file);
    return deps.map((dep) => ({
      filename: dep,
      startLine: 0,
      endLine: 0,
      code: dep,
    }));
  }

  /**
   * Analyze the impact radius of changes to a file
   * Required by CodeGraph interface - currently a stub
   *
   * LIMITATION: Full impact analysis is not yet implemented.
   * This would require:
   * 1. Building reverse dependency graph (who imports this file)
   * 2. Finding all function callers across the codebase
   * 3. Identifying derived classes (requires inheritance tracking)
   * 4. Calculating transitive impact (affected files that import affected files)
   *
   * Current behavior: Returns a stub response indicating low impact.
   * Reviews may underestimate the blast radius of changes to widely-used files.
   *
   * Workaround: The code graph still provides dependency context for the
   * changed files themselves, which helps LLMs understand direct relationships.
   *
   * Tracked in issue #TODO
   */
  findImpactRadius(file: string): ImpactAnalysis {
    return {
      file,
      totalAffected: 0,
      callers: [],
      consumers: [],
      derived: [],
      impactLevel: 'low',
      summary: 'Impact analysis not yet implemented - file relationships are tracked but impact radius calculation is pending',
    };
  }

  /**
   * Get statistics about the graph
   */
  getStats(): {
    files: number;
    definitions: number;
    imports: number;
    calls: number;
    buildTimeMs: number;
  } {
    return {
      files: this.files.length,
      definitions: this.definitions.size,
      imports: Array.from(this.imports.values()).flat().length,
      calls: Array.from(this.calls.values()).flat().length,
      buildTimeMs: this.buildTime,
    };
  }

  /**
   * Copy graph data from another CodeGraph instance
   * Type-safe alternative to direct private field assignment
   * Deep copies all arrays to prevent shared mutable state
   */
  copyFrom(other: CodeGraph): void {
    // Deep copy definitions (value is Definition object, not array)
    this.definitions = new Map(other.definitions);

    // Deep copy array values in all maps to prevent shared mutable state
    this.imports = new Map(
      Array.from(other.imports.entries()).map(([k, v]) => [k, [...v]])
    );
    this.exports = new Map(
      Array.from(other.exports.entries()).map(([k, v]) => [k, [...v]])
    );
    this.calls = new Map(
      Array.from(other.calls.entries()).map(([k, v]) => [k, [...v]])
    );
    this.callers = new Map(
      Array.from(other.callers.entries()).map(([k, v]) => [k, [...v]])
    );
    this.fileSymbols = new Map(
      Array.from(other.fileSymbols.entries()).map(([k, v]) => [k, [...v]])
    );
  }

  /**
   * Create a deep clone of the graph for incremental updates
   * All arrays are deep copied to prevent shared mutable state
   */
  clone(): CodeGraph {
    const cloned = new CodeGraph([...this.files], this.buildTime);
    cloned.copyFrom(this);
    return cloned;
  }

  /**
   * Serialize graph to JSON for caching
   * Deep copies all arrays to prevent mutations from affecting the graph
   */
  serialize(): SerializedGraph {
    return {
      files: [...this.files], // Copy files array
      buildTime: this.buildTime,
      definitions: Array.from(this.definitions.entries()),
      // Deep copy array values to prevent shared mutable references
      imports: Array.from(this.imports.entries()).map(([k, v]) => [k, [...v]]),
      exports: Array.from(this.exports.entries()).map(([k, v]) => [k, [...v]]),
      calls: Array.from(this.calls.entries()).map(([k, v]) => [k, [...v]]),
      callers: Array.from(this.callers.entries()).map(([k, v]) => [k, [...v]]),
      fileSymbols: Array.from(this.fileSymbols.entries()).map(([k, v]) => [k, [...v]]),
    };
  }

  /**
   * Deserialize graph from JSON
   * Deep copies all arrays to ensure the graph owns its own memory
   */
  static deserialize(data: ReturnType<CodeGraph['serialize']>): CodeGraph {
    // Validate structure to handle corrupted cache data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid graph data: expected object');
    }
    if (!Array.isArray(data.files)) {
      throw new Error('Invalid graph data: files must be an array');
    }
    if (typeof data.buildTime !== 'number') {
      throw new Error('Invalid graph data: buildTime must be a number');
    }

    // Validate all map fields are arrays
    const mapFields: Array<keyof SerializedGraph> = ['definitions', 'imports', 'exports', 'calls', 'callers', 'fileSymbols'];
    for (const field of mapFields) {
      if (!Array.isArray(data[field])) {
        throw new Error(`Invalid graph data: ${field} must be an array`);
      }
    }

    // Validate Definition objects have required fields
    if (!Array.isArray(data.definitions)) {
      throw new Error('Invalid graph data: definitions must be an array');
    }
    for (const [key, def] of data.definitions) {
      if (!def || typeof def !== 'object') {
        throw new Error(`Invalid definition for key ${key}: must be an object`);
      }
      if (typeof def.name !== 'string' || !def.name) {
        throw new Error(`Invalid definition for key ${key}: name must be a non-empty string`);
      }
      if (typeof def.file !== 'string' || !def.file) {
        throw new Error(`Invalid definition for key ${key}: file must be a non-empty string`);
      }
      if (typeof def.line !== 'number' || def.line < 1) {
        throw new Error(`Invalid definition for key ${key}: line must be a positive number (>= 1)`);
      }
      const validTypes = ['function', 'class', 'variable', 'type', 'interface'];
      if (!validTypes.includes(def.type)) {
        throw new Error(`Invalid definition for key ${key}: type must be one of ${validTypes.join(', ')}`);
      }
      if (typeof def.exported !== 'boolean') {
        throw new Error(`Invalid definition for key ${key}: exported must be a boolean`);
      }
    }

    // Create graph with copied files array
    const graph = new CodeGraph([...data.files], data.buildTime);

    // Deep copy array values when constructing maps to ensure graph owns its own memory
    graph.definitions = new Map(data.definitions);
    graph.imports = new Map(data.imports.map(([k, v]) => [k, [...v]]));
    graph.exports = new Map(data.exports.map(([k, v]) => [k, [...v]]));
    graph.calls = new Map(data.calls.map(([k, v]) => [k, [...v]]));
    graph.callers = new Map(data.callers.map(([k, v]) => [k, [...v]]));
    graph.fileSymbols = new Map(data.fileSymbols.map(([k, v]) => [k, [...v]]));
    return graph;
  }
}

/**
 * Builds a code graph from file changes using AST analysis
 */
export class CodeGraphBuilder {
  private tsParser: Parser | null = null;
  private tsxParser: Parser | null = null;
  private pyParser: Parser | null = null;
  private parsersInitialized = false;

  constructor(
    private readonly maxDepth: number = 5,
    private readonly timeoutMs: number = 10000
  ) {}

  /**
   * Lazy-load and initialize parsers only when needed
   */
  private async initParsers(): Promise<void> {
    if (this.parsersInitialized) {
      return;
    }

    try {
      // Dynamic imports to avoid bundling native modules
      const ParserModule = await import('tree-sitter');
      const TypeScriptParser = await import('tree-sitter-typescript');
      const PythonParser = await import('tree-sitter-python');

      const Parser = ParserModule.default;
      this.tsParser = new Parser();
      this.tsxParser = new Parser();
      this.pyParser = new Parser();

      this.tsParser.setLanguage(TypeScriptParser.default.typescript);
      this.tsxParser.setLanguage(TypeScriptParser.default.tsx);
      this.pyParser.setLanguage(PythonParser.default);
      this.parsersInitialized = true;
    } catch (error) {
      logger.warn('Failed to initialize parsers - AST analysis disabled', error as Error);
      this.parsersInitialized = true; // Mark as initialized even if failed to avoid retrying
    }
  }

  /**
   * Build a code graph from file changes
   */
  async buildGraph(files: FileChange[]): Promise<CodeGraph> {
    const startTime = Date.now();
    const graph = new CodeGraph();

    logger.info(`Building code graph for ${files.length} files`);

    for (const file of files) {
      try {
        await this.analyzeFile(file, graph);
      } catch (error) {
        logger.warn(`Failed to analyze ${file.filename}`, error as Error);
      }

      // Check timeout
      if (Date.now() - startTime > this.timeoutMs) {
        logger.warn(`Graph build timeout after ${this.timeoutMs}ms, stopping early`);
        break;
      }
    }

    const buildTime = Date.now() - startTime;
    const finalGraph = new CodeGraph(
      files.map((f) => f.filename),
      buildTime
    );

    // Copy graph data using type-safe method
    finalGraph.copyFrom(graph);

    logger.info(`Code graph built in ${buildTime}ms: ${graph.getStats().definitions} definitions, ${graph.getStats().imports} imports`);

    return finalGraph;
  }

  /**
   * Update an existing graph with changed files
   */
  async updateGraph(graph: CodeGraph, changedFiles: FileChange[]): Promise<CodeGraph> {
    const startTime = Date.now();

    logger.info(`Updating code graph with ${changedFiles.length} changed files`);

    // Remove stale data and re-analyze changed files
    for (const file of changedFiles) {
      try {
        // Remove old data for this file to avoid stale entries
        graph.removeFile(file.filename);

        // Re-analyze the file with fresh data
        await this.analyzeFile(file, graph);
      } catch (error) {
        logger.warn(`Failed to analyze ${file.filename}`, error as Error);
      }
    }

    const updateTime = Date.now() - startTime;
    logger.info(`Code graph updated in ${updateTime}ms`);

    return graph;
  }

  /**
   * Analyze a single file and add to graph
   */
  private async analyzeFile(file: FileChange, graph: CodeGraph): Promise<void> {
    // Ensure parsers are initialized
    await this.initParsers();

    const ext = file.filename.split('.').pop()?.toLowerCase();
    let parser: Parser | null = null;

    // Route to appropriate parser based on file extension
    if (ext === 'tsx' || ext === 'jsx') {
      parser = this.tsxParser;
    } else if (ext === 'ts' || ext === 'js') {
      parser = this.tsParser;
    } else if (ext === 'py') {
      parser = this.pyParser;
    }

    if (!parser || !file.patch) {
      return;
    }

    // CRITICAL LIMITATION: We only have patch (diff) content, not full file content
    // This means AST analysis will be incomplete and may produce misleading results.
    //
    // IMPACT: Code graph may miss:
    //   - Imports outside the changed lines
    //   - Function/class definitions outside the patch
    //   - Accurate line numbers for definitions
    //   - Complete dependency relationships
    //
    // TODO: Fetch full file content from GitHub API for reliable analysis
    //       Implementation steps:
    //       1. Use GitHub API: GET /repos/{owner}/{repo}/contents/{path}?ref={sha}
    //       2. Cache full file contents to reduce API calls
    //       3. Fallback to patch-only for rate limit/error cases
    //       4. Update AST parsing to use full content
    //
    // WORKAROUND: Current implementation extracts added lines from patch for
    // partial analysis. This works for simple cases but may miss cross-file
    // relationships. LLMs still receive the full diff context in the prompt.
    //
    // Tracked in issue #TODO
    logger.warn(`Analyzing patch-only for ${file.filename} - AST may be incomplete/invalid`);

    // Try to extract added lines from patch for partial analysis
    const addedLines = this.extractAddedLines(file.patch);
    if (addedLines.length === 0) {
      logger.debug(`No added lines found in patch for ${file.filename}, skipping AST analysis`);
      return;
    }

    // Parse added lines only (best-effort analysis)
    const codeToAnalyze = addedLines.join('\n');

    // Fail-fast: Skip AST analysis if code looks like a fragment
    if (this.looksLikeFragment(codeToAnalyze)) {
      logger.warn(`Skipping AST analysis for ${file.filename}: code appears to be a fragment (unbalanced braces or no top-level declarations)`);
      return;
    }

    const tree = parser.parse(codeToAnalyze);
    const root = tree.rootNode;

    // Extract definitions
    this.extractDefinitions(root, file.filename, graph);

    // Extract imports
    this.extractImports(root, file.filename, graph);

    // Extract calls
    this.extractCalls(root, file.filename, graph);
  }

  /**
   * Extract symbol definitions from AST
   */
  private extractDefinitions(node: SyntaxNode, file: string, graph: CodeGraph): void {
    // Function declarations
    if (node.type === 'function_declaration' || node.type === 'function') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        graph.addDefinition({
          name: nameNode.text,
          file,
          line: node.startPosition.row + 1,
          type: 'function',
          exported: this.isExported(node),
        });
      }
    }

    // Class declarations
    if (node.type === 'class_declaration' || node.type === 'class') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        graph.addDefinition({
          name: nameNode.text,
          file,
          line: node.startPosition.row + 1,
          type: 'class',
          exported: this.isExported(node),
        });
      }
    }

    // Recurse through children
    for (let i = 0; i < node.childCount; i++) {
      this.extractDefinitions(node.child(i)!, file, graph);
    }
  }

  /**
   * Extract import statements from AST
   */
  private extractImports(node: SyntaxNode, file: string, graph: CodeGraph): void {
    // ES6 imports: import { foo } from './bar'
    if (node.type === 'import_statement') {
      const sourceNode = node.childForFieldName('source');
      if (sourceNode) {
        // ES6/TypeScript import with source
        const source = sourceNode.text.replace(/['"]/g, '');
        graph.addImport(file, source);
      } else {
        // Python plain import: import os, import foo.bar
        // Iterate over children to find dotted_name or aliased_import nodes
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (!child) continue;

          if (child.type === 'dotted_name') {
            // Plain import: import os
            graph.addImport(file, child.text);
          } else if (child.type === 'aliased_import') {
            // Aliased import: import foo as bar
            // Extract the original module name (left side before "as")
            const nameNode = child.childForFieldName('name');
            if (nameNode) {
              graph.addImport(file, nameNode.text);
            }
          }
        }
      }
    }

    // Python imports: from foo import bar
    if (node.type === 'import_from_statement') {
      const moduleNode = node.childForFieldName('module_name');
      if (moduleNode) {
        graph.addImport(file, moduleNode.text);
      }
    }

    // Recurse through children
    for (let i = 0; i < node.childCount; i++) {
      this.extractImports(node.child(i)!, file, graph);
    }
  }

  /**
   * Extract function/method calls from AST
   */
  private extractCalls(node: SyntaxNode, file: string, graph: CodeGraph): void {
    // Function calls
    if (node.type === 'call_expression') {
      const functionNode = node.childForFieldName('function');
      if (functionNode) {
        const callee = functionNode.text;
        // Find the enclosing function (caller)
        const caller = this.findEnclosingFunction(node);
        if (caller && callee) {
          graph.addCall(file, caller, callee);
        }
      }
    }

    // Recurse through children
    for (let i = 0; i < node.childCount; i++) {
      this.extractCalls(node.child(i)!, file, graph);
    }
  }

  /**
   * Find the name of the enclosing function for a given node
   * Returns '<top>' for top-level calls
   */
  private findEnclosingFunction(node: SyntaxNode): string | null {
    let current: SyntaxNode | null = node.parent;

    while (current) {
      // Check for function declaration
      if (current.type === 'function_declaration' || current.type === 'function') {
        const nameNode = current.childForFieldName('name');
        if (nameNode) {
          return nameNode.text;
        }
      }

      // Check for method definition
      if (current.type === 'method_definition') {
        const nameNode = current.childForFieldName('name');
        if (nameNode) {
          return nameNode.text;
        }
      }

      // Check for arrow function assigned to variable
      if (current.type === 'lexical_declaration' || current.type === 'variable_declaration') {
        const declarator = current.childForFieldName('declarator');
        if (declarator) {
          const nameNode = declarator.childForFieldName('name');
          if (nameNode) {
            return nameNode.text;
          }
        }
      }

      current = current.parent;
    }

    // Top-level call (not inside any function)
    return '<top>';
  }

  /**
   * Check if a node has an export modifier
   */
  private isExported(node: SyntaxNode): boolean {
    // Check if parent or sibling has 'export' keyword
    let current: SyntaxNode | null = node;
    while (current) {
      if (current.type === 'export_statement') {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Extract added lines from a unified diff patch
   * Returns lines that start with '+' (excluding the '+' prefix)
   */
  private extractAddedLines(patch: string): string[] {
    const lines = patch.split('\n');
    const addedLines: string[] = [];

    for (const line of lines) {
      // Skip diff headers (@@ lines) and context lines
      if (line.startsWith('@@')) {
        continue;
      }
      // Extract added lines (start with +, but not +++ which is the diff file header)
      // This allows ++ (increment operators like ++counter)
      if (line.startsWith('+') && !line.startsWith('+++')) {
        // Remove the + prefix
        addedLines.push(line.substring(1));
      }
    }

    return addedLines;
  }

  /**
   * Check if code looks like a fragment that would produce invalid AST
   * Returns true if code has unbalanced braces or lacks top-level declarations
   */
  private looksLikeFragment(code: string): boolean {
    // Check for unbalanced braces
    let braceCount = 0;
    let parenCount = 0;
    let bracketCount = 0;

    for (const char of code) {
      if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
      else if (char === '(') parenCount++;
      else if (char === ')') parenCount--;
      else if (char === '[') bracketCount++;
      else if (char === ']') bracketCount--;
    }

    // If any brackets are unbalanced, it's a fragment
    if (braceCount !== 0 || parenCount !== 0 || bracketCount !== 0) {
      return true;
    }

    // Check for presence of top-level declarations
    // JS/TS: function/class/const/let/var/type/interface/export
    // Python: def/class/import/from
    const hasTopLevelDeclaration = /^\s*(export\s+)?(function|class|const|let|var|type|interface|async\s+function|def|async\s+def|import|from)\s+/m.test(code);

    return !hasTopLevelDeclaration;
  }
}
