import { CodeSnippet, FileChange, UnchangedContext } from '../types';
import { mapAddedLines } from '../utils/diff';

export class ContextRetriever {
  findRelatedContext(files: FileChange[]): UnchangedContext[] {
    const contexts: UnchangedContext[] = [];

    for (const file of files) {
      const snippets = this.buildSnippets(file);
      const downstreamConsumers = this.extractImports(file.patch);

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
}
