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
  removeFile(file: string): void {
    // Remove all definitions for this file
    const symbolNames = this.fileSymbols.get(file) || [];
    for (const name of symbolNames) {
      this.definitions.delete(`${file}:${name}`);
    }
    this.fileSymbols.delete(file);

    // Remove imports from this file
    this.imports.delete(file);

    // Remove exports from this file
    this.exports.delete(file);

    // Remove calls made from functions in this file
    // Iterate through this file's symbols and clean up their call edges
    for (const symbolName of symbolNames) {
      // Remove calls made by this symbol
      const callees = this.calls.get(symbolName);
      if (callees) {
        // Remove this caller from all callees' caller lists
        for (const callee of callees) {
          const callerList = this.callers.get(callee);
          if (callerList) {
            const filtered = callerList.filter(c => c !== symbolName);
            if (filtered.length > 0) {
              this.callers.set(callee, filtered);
            } else {
              this.callers.delete(callee);
            }
          }
        }
        this.calls.delete(symbolName);
      }

      // Remove calls to this symbol (clean up callers list)
      this.callers.delete(symbolName);
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
  addCall(caller: string, callee: string): void {
    // Track caller → callee
    const called = this.calls.get(caller) || [];
    if (!called.includes(callee)) {
      called.push(callee);
      this.calls.set(caller, called);
    }

    // Track callee → callers (reverse index)
    const callerList = this.callers.get(callee) || [];
    if (!callerList.includes(caller)) {
      callerList.push(caller);
      this.callers.set(callee, callerList);
    }
  }

  /**
   * Find all places where a symbol is called/used
   */
  findCallers(symbol: string): GraphCodeSnippet[] {
    const callerList = this.callers.get(symbol) || [];
    const snippets: GraphCodeSnippet[] = [];

    for (const caller of callerList) {
      // Find the definition of the caller
      for (const [key, def] of this.definitions) {
        if (key.endsWith(`:${caller}`)) {
          snippets.push({
            file: def.file,
            line: def.line,
            code: `${def.type} ${def.name}`,
            context: `Called from ${def.name}`,
          });
        }
      }
    }

    return snippets;
  }

  /**
   * Find all files that import/depend on a given file
   */
  findConsumers(file: string): GraphCodeSnippet[] {
    const consumers: GraphCodeSnippet[] = [];
    // Normalize the file path for consistent comparison
    const normalizedFile = file.replace(/\\/g, '/');

    for (const [fromFile, toFiles] of this.imports) {
      // Check if any imported path matches (could be relative or absolute)
      const hasMatch = toFiles.some(importedPath => {
        // Direct match with normalized path
        if (importedPath === normalizedFile) return true;
        // Also check if the resolved path ends with the file (for relative comparisons)
        if (importedPath.endsWith(normalizedFile)) return true;
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
    // Normalize the file path for consistent comparison
    const normalizedFile = file.replace(/\\/g, '/');

    for (const [fromFile, toFiles] of this.imports) {
      // Check if any imported path matches (could be relative or absolute)
      const hasMatch = toFiles.some(importedPath => {
        // Direct match with normalized path
        if (importedPath === normalizedFile) return true;
        // Also check if the resolved path ends with the file (for relative comparisons)
        if (importedPath.endsWith(normalizedFile)) return true;
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
   */
  findDerivedClasses(_className: string): CodeSnippet[] {
    // TODO: Implement class inheritance tracking
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
   */
  findImpactRadius(file: string): ImpactAnalysis {
    // TODO: Implement full impact analysis
    return {
      file,
      totalAffected: 0,
      callers: [],
      consumers: [],
      derived: [],
      impactLevel: 'low',
      summary: 'Impact analysis not yet implemented',
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
   */
  copyFrom(other: CodeGraph): void {
    this.definitions = new Map(other.definitions);
    this.imports = new Map(other.imports.entries());
    this.exports = new Map(other.exports.entries());
    this.calls = new Map(other.calls.entries());
    this.callers = new Map(other.callers.entries());
    this.fileSymbols = new Map(other.fileSymbols.entries());
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
    // This means AST analysis will be incomplete and may produce misleading results
    // TODO: [#XXX] Fetch full file content from GitHub API for reliable analysis
    //       - Use GitHub API: GET /repos/{owner}/{repo}/contents/{path}?ref={sha}
    //       - Cache full file contents to reduce API calls
    //       - Fallback to patch-only for rate limit/error cases
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
          graph.addCall(caller, callee);
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
      // Extract added lines (start with +, but not ++)
      if (line.startsWith('+') && !line.startsWith('++')) {
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
    // At minimum, we expect function/class/const/let/var/type/interface/export
    const hasTopLevelDeclaration = /^\s*(export\s+)?(function|class|const|let|var|type|interface|async\s+function)\s+/m.test(code);

    return !hasTopLevelDeclaration;
  }
}
