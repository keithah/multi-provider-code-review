import { CodeSnippet, FileChange, UnchangedContext } from '../types';
import { mapAddedLines } from '../utils/diff';
import { CodeGraph } from './context/graph-builder';
import { logger } from '../utils/logger';

export class ContextRetriever {
  constructor(private readonly graph?: CodeGraph) {}

  findRelatedContext(files: FileChange[]): UnchangedContext[] {
    const contexts: UnchangedContext[] = [];

    for (const file of files) {
      const snippets = this.buildSnippets(file);
      const downstreamConsumers = this.graph
        ? this.extractImportsFromGraph(file.filename)
        : this.extractImports(file.patch);

      if (snippets.length === 0 && downstreamConsumers.length === 0) continue;

      contexts.push({
        file: file.filename,
        relationship: downstreamConsumers.length > 0 ? 'dependency' : 'consumer',
        affectedCode: snippets,
        impactLevel: 'medium',
        downstreamConsumers,
      });
    }

    return contexts;
  }

  private buildSnippets(file: FileChange): CodeSnippet[] {
    const added = mapAddedLines(file.patch);
    if (added.length === 0) return [];

    return added.map(line => ({
      filename: file.filename,
      startLine: line.line,
      endLine: line.line,
      code: line.content,
    }));
  }

  private extractImports(patch?: string): string[] {
    if (!patch) return [];
    const imports: string[] = [];
    const regexes = [/import .*?from ['"](.+?)['"]/, /require\\(['"](.+?)['"]\\)/];

    for (const raw of patch.split('\n')) {
      if (!raw.startsWith('+')) continue;
      for (const rx of regexes) {
        const match = raw.match(rx);
        if (match && match[1]) {
          imports.push(match[1]);
          break;
        }
      }
    }

    return Array.from(new Set(imports));
  }

  /**
   * Extract imports using code graph (more accurate than regex)
   */
  private extractImportsFromGraph(filename: string): string[] {
    if (!this.graph) {
      return [];
    }

    const dependencies = this.graph.getDependencies(filename);
    logger.debug(`Graph-based import extraction for ${filename}: ${dependencies.length} imports`);
    return dependencies;
  }

  /**
   * Find all files that depend on the given file
   */
  findDependents(filename: string): string[] {
    if (!this.graph) {
      logger.debug('No code graph available, cannot find dependents');
      return [];
    }

    return this.graph.getDependents(filename);
  }

  /**
   * Find all places where a symbol is used
   */
  findUsages(symbolName: string): CodeSnippet[] {
    if (!this.graph) {
      return [];
    }

    const callers = this.graph.findCallers(symbolName);
    return callers.map((snippet) => ({
      filename: snippet.file,
      startLine: snippet.line,
      endLine: snippet.line,
      code: snippet.code,
    }));
  }
}
