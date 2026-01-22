import { FileChange, UnchangedContext } from '../types';

export class MermaidGenerator {
  generateImpactDiagram(files: FileChange[], context: UnchangedContext[]): string {
    if (files.length > 30) return '';
    const lines: string[] = ['graph TD'];
    const fileNodes = new Set<string>();

    for (const file of files) {
      const node = this.normalizeNode(file.filename);
      fileNodes.add(node);
      lines.push(`${node}[${file.filename}]`);
    }

    for (const ctx of context.slice(0, 50)) {
      const from = this.normalizeNode(ctx.file);
      if (!fileNodes.has(from)) {
        lines.push(`${from}[${ctx.file}]`);
        fileNodes.add(from);
      }

      for (const consumer of ctx.downstreamConsumers.slice(0, 50)) {
        const to = this.normalizeNode(consumer);
        if (!fileNodes.has(to)) {
          lines.push(`${to}[${consumer}]`);
          fileNodes.add(to);
        }
        lines.push(`${from} --> ${to}`);
      }
    }

    return lines.join('\n');
  }

  private normalizeNode(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
  }
}
