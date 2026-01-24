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

    // For now, rebuild from scratch for changed files
    // TODO: Implement incremental update
    for (const file of changedFiles) {
      try {
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

    // Parse the entire file content (not just patch)
    // Note: In real usage, we'd need the full file content
    const tree = parser.parse(file.patch);
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
        // Look for dotted_name child
        const dottedName = node.childForFieldName('dotted_name');
        if (dottedName) {
          graph.addImport(file, dottedName.text);
        }

        // Also handle aliased_import: import foo as bar
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child && child.type === 'aliased_import') {
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
        // TODO: Track the caller context (which function is making this call)
        // const callee = functionNode.text;
        // For now, we'll just track the call exists
      }
    }

    // Recurse through children
    for (let i = 0; i < node.childCount; i++) {
      this.extractCalls(node.child(i)!, file, graph);
    }
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
}
