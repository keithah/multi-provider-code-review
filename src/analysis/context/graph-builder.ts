import { FileChange, CodeSnippet, ImpactAnalysis } from '../../types';
import { logger } from '../../utils/logger';
import Parser from 'tree-sitter';
import TypeScriptParser from 'tree-sitter-typescript';
import PythonParser from 'tree-sitter-python';

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
    const imported = this.imports.get(fromFile) || [];
    if (!imported.includes(toFile)) {
      imported.push(toFile);
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

    for (const [fromFile, toFiles] of this.imports) {
      if (toFiles.includes(file)) {
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
    for (const [fromFile, toFiles] of this.imports) {
      if (toFiles.includes(file)) {
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
}

/**
 * Builds a code graph from file changes using AST analysis
 */
export class CodeGraphBuilder {
  private readonly parser: Parser;
  private readonly tsParser: Parser;
  private readonly pyParser: Parser;

  constructor(
    private readonly maxDepth: number = 5,
    private readonly timeoutMs: number = 10000
  ) {
    this.parser = new Parser();
    this.tsParser = new Parser();
    this.pyParser = new Parser();

    try {
      this.tsParser.setLanguage(TypeScriptParser.typescript);
      this.pyParser.setLanguage(PythonParser);
    } catch (error) {
      logger.warn('Failed to initialize parsers', error as Error);
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

    // Copy Maps from working graph to final graph
    // @ts-expect-error - accessing private field definitions to copy graph data
    finalGraph.definitions = graph.definitions;
    // @ts-expect-error - accessing private field imports to copy graph data
    finalGraph.imports = graph.imports;
    // @ts-expect-error - accessing private field exports to copy graph data
    finalGraph.exports = graph.exports;
    // @ts-expect-error - accessing private field calls to copy graph data
    finalGraph.calls = graph.calls;
    // @ts-expect-error - accessing private field callers to copy graph data
    finalGraph.callers = graph.callers;
    // @ts-expect-error - accessing private field fileSymbols to copy graph data
    finalGraph.fileSymbols = graph.fileSymbols;

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
    const ext = file.filename.split('.').pop()?.toLowerCase();
    let parser: Parser | null = null;

    if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') {
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
  private extractDefinitions(node: Parser.SyntaxNode, file: string, graph: CodeGraph): void {
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
  private extractImports(node: Parser.SyntaxNode, file: string, graph: CodeGraph): void {
    // ES6 imports: import { foo } from './bar'
    if (node.type === 'import_statement') {
      const sourceNode = node.childForFieldName('source');
      if (sourceNode) {
        const source = sourceNode.text.replace(/['"]/g, '');
        graph.addImport(file, source);
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
  private extractCalls(node: Parser.SyntaxNode, file: string, graph: CodeGraph): void {
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
  private isExported(node: Parser.SyntaxNode): boolean {
    // Check if parent or sibling has 'export' keyword
    let current: Parser.SyntaxNode | null = node;
    while (current) {
      if (current.type === 'export_statement') {
        return true;
      }
      current = current.parent;
    }
    return false;
  }
}
