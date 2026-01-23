import { FileChange, UnchangedContext } from '../types';

export class MermaidGenerator {
  generateImpactDiagram(files: FileChange[], context: UnchangedContext[]): string {
    if (files.length > 30) return '';
    const lines: string[] = ['graph TD'];
    const fileNodes = new Set<string>();
    const usedIds = new Set<string>();

    for (const file of files) {
      const node = this.normalizeNode(file.filename, usedIds);
      fileNodes.add(node);
      lines.push(`${node}["${this.escapeLabel(file.filename)}"]`);
    }

    for (const ctx of context.slice(0, 50)) {
      const from = this.normalizeNode(ctx.file, usedIds);
      if (!fileNodes.has(from)) {
        lines.push(`${from}["${this.escapeLabel(ctx.file)}"]`);
        fileNodes.add(from);
      }

      for (const consumer of ctx.downstreamConsumers.slice(0, 50)) {
        const to = this.normalizeNode(consumer, usedIds);
        if (!fileNodes.has(to)) {
          lines.push(`${to}["${this.escapeLabel(consumer)}"]`);
          fileNodes.add(to);
        }
        lines.push(`${from} --> ${to}`);
      }
    }

    return lines.join('\n');
  }

  private normalizeNode(name: string, used: Set<string>): string {
    let base = name.replace(/[^a-zA-Z0-9]/g, '_');
    if (/^[0-9]/.test(base)) {
      base = `n_${base}`;
    }
    let candidate = base || 'node';
    let counter = 1;
    while (used.has(candidate)) {
      candidate = `${base}_${counter++}`;
    }
    used.add(candidate);
    return candidate;
  }

  private escapeLabel(label: string): string {
    return label
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/]/g, '&#93;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
