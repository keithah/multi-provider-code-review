import { CodeGraphBuilder, CodeGraph } from '../../../../src/analysis/context/graph-builder';
import { FileChange } from '../../../../src/types';

describe('CodeGraphBuilder', () => {
  let builder: CodeGraphBuilder;

  beforeEach(() => {
    builder = new CodeGraphBuilder();
  });

  describe('buildGraph', () => {
    it('should build graph from file changes', async () => {
      const files: FileChange[] = [
        {
          filename: 'src/test.ts',
          status: 'modified',
          additions: 5,
          deletions: 2,
          changes: 7,
          patch: `@@ -1,3 +1,5 @@
+function foo() {
+  return 'test';
+}`,
        },
      ];

      const graph = await builder.buildGraph(files);

      expect(graph).toBeInstanceOf(CodeGraph);
      expect(graph.files).toContain('src/test.ts');
    });

    it('should handle empty file list', async () => {
      const graph = await builder.buildGraph([]);
      expect(graph.files).toEqual([]);
    });
  });

  describe('updateGraph', () => {
    it('should update graph with changed files', async () => {
      const graph = new CodeGraph();
      const spy = jest.spyOn(graph, 'removeFile');

      await builder.updateGraph(graph, [{
        filename: 'test.ts',
        patch: '+const x = 1;',
      } as any]);

      expect(spy).toHaveBeenCalledWith('test.ts');
    });
  });

  describe('CodeGraph', () => {
    it('should track definitions and remove file data', () => {
      const graph = new CodeGraph();
      graph.addDefinition({
        name: 'foo',
        file: 'test.ts',
        line: 1,
        type: 'function',
        exported: false,
      });

      graph.removeFile('test.ts');

      const symbols = graph.getFileSymbols('test.ts');
      expect(symbols).toHaveLength(0);
    });

    it('should track imports and calls', () => {
      const graph = new CodeGraph();
      graph.addImport('a.ts', './b.ts');
      // Add definitions for the functions first
      graph.addDefinition({ name: 'foo', file: 'a.ts', line: 1, type: 'function', exported: false });
      graph.addDefinition({ name: 'bar', file: 'b.ts', line: 1, type: 'function', exported: false });
      // Now add the call relationship
      graph.addCall('a.ts', 'foo', 'bar');

      expect(graph.getDependencies('a.ts')).toContain('./b.ts');
      expect(graph.findCallers('bar').length).toBeGreaterThan(0);
    });
  });
});
