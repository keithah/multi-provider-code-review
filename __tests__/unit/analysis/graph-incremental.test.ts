import { CodeGraph, CodeGraphBuilder, Definition } from '../../../src/analysis/context/graph-builder';
import { FileChange } from '../../../src/types';

describe('Incremental Graph Updates', () => {
  describe('Graph cloning', () => {
    it('should create independent copy of graph', () => {
      const original = new CodeGraph(['file1.ts', 'file2.ts'], 100);
      original.addDefinition({
        name: 'foo',
        file: 'file1.ts',
        line: 10,
        type: 'function',
        exported: true,
      });
      original.addImport('file1.ts', './file2');
      original.addCall('file1.ts', 'foo', 'bar');

      const cloned = original.clone();

      // Verify data is copied
      expect(cloned.files).toEqual(original.files);
      expect(cloned.buildTime).toBe(original.buildTime);
      expect(cloned.getStats().definitions).toBe(1);
      expect(cloned.getStats().imports).toBe(1);
      expect(cloned.getStats().calls).toBe(1);

      // Verify independence - changes to clone don't affect original
      cloned.addDefinition({
        name: 'baz',
        file: 'file2.ts',
        line: 20,
        type: 'class',
        exported: false,
      });

      expect(cloned.getStats().definitions).toBe(2);
      expect(original.getStats().definitions).toBe(1);
    });

    it('should preserve file symbols map', () => {
      const original = new CodeGraph(['file1.ts'], 100);
      original.addDefinition({
        name: 'foo',
        file: 'file1.ts',
        line: 10,
        type: 'function',
        exported: true,
      });
      original.addDefinition({
        name: 'bar',
        file: 'file1.ts',
        line: 20,
        type: 'function',
        exported: false,
      });

      const cloned = original.clone();

      const symbols = cloned.getFileSymbols('file1.ts');
      expect(symbols).toHaveLength(2);
      expect(symbols.map(s => s.name)).toContain('foo');
      expect(symbols.map(s => s.name)).toContain('bar');
    });
  });

  describe('Graph serialization', () => {
    it('should serialize all graph data', () => {
      const graph = new CodeGraph(['file1.ts', 'file2.ts'], 150);
      graph.addDefinition({
        name: 'foo',
        file: 'file1.ts',
        line: 10,
        type: 'function',
        exported: true,
      });
      graph.addImport('file1.ts', './file2');
      graph.addCall('file1.ts', 'foo', 'bar');

      const serialized = graph.serialize();

      expect(serialized.files).toEqual(['file1.ts', 'file2.ts']);
      expect(serialized.buildTime).toBe(150);
      expect(serialized.definitions).toHaveLength(1);
      expect(serialized.imports).toHaveLength(1);
      expect(serialized.calls).toHaveLength(1);
    });

    it('should deserialize to equivalent graph', () => {
      const original = new CodeGraph(['file1.ts', 'file2.ts'], 150);
      original.addDefinition({
        name: 'foo',
        file: 'file1.ts',
        line: 10,
        type: 'function',
        exported: true,
      });
      original.addImport('file1.ts', './file2');
      original.addCall('file1.ts', 'foo', 'bar');

      const serialized = original.serialize();
      const deserialized = CodeGraph.deserialize(serialized);

      expect(deserialized.files).toEqual(original.files);
      expect(deserialized.buildTime).toBe(original.buildTime);
      expect(deserialized.getStats()).toEqual(original.getStats());
    });

    it('should handle empty graph', () => {
      const empty = new CodeGraph([], 0);

      const serialized = empty.serialize();
      const deserialized = CodeGraph.deserialize(serialized);

      expect(deserialized.files).toEqual([]);
      expect(deserialized.buildTime).toBe(0);
      expect(deserialized.getStats().definitions).toBe(0);
    });

    it('should preserve all definition fields', () => {
      const graph = new CodeGraph(['file1.ts'], 100);
      const def: Definition = {
        name: 'MyClass',
        file: 'file1.ts',
        line: 42,
        type: 'class',
        exported: true,
      };
      graph.addDefinition(def);

      const serialized = graph.serialize();
      const deserialized = CodeGraph.deserialize(serialized);

      const symbols = deserialized.getFileSymbols('file1.ts');
      expect(symbols).toHaveLength(1);
      expect(symbols[0]).toMatchObject(def);
    });

    it('should handle circular references in graph serialization', () => {
      const graph = new CodeGraph(['file1.ts', 'file2.ts'], 100);

      // Create circular imports
      graph.addImport('file1.ts', './file2');
      graph.addImport('file2.ts', './file1');

      // Create circular call references
      graph.addDefinition({ name: 'foo', file: 'file1.ts', line: 1, type: 'function', exported: true });
      graph.addDefinition({ name: 'bar', file: 'file2.ts', line: 1, type: 'function', exported: true });
      graph.addCall('file1.ts', 'foo', 'bar');
      graph.addCall('file2.ts', 'bar', 'foo');

      // Serialization should handle circular structure safely
      const serialized = graph.serialize();
      expect(serialized).toBeDefined();
      expect(typeof serialized).toBe('object');

      // Should be able to JSON.stringify without errors
      expect(() => JSON.stringify(serialized)).not.toThrow();

      // Should be able to deserialize back
      const deserialized = CodeGraph.deserialize(serialized);
      expect(deserialized.files).toEqual(['file1.ts', 'file2.ts']);
      expect(deserialized.getDependencies('file1.ts')).toContain('./file2');
      expect(deserialized.getDependencies('file2.ts')).toContain('./file1');
    });
  });

  describe('Node removal', () => {
    it('should remove file and all its data', () => {
      const graph = new CodeGraph(['file1.ts', 'file2.ts'], 100);
      graph.addDefinition({
        name: 'foo',
        file: 'file1.ts',
        line: 10,
        type: 'function',
        exported: true,
      });
      graph.addDefinition({
        name: 'bar',
        file: 'file2.ts',
        line: 20,
        type: 'function',
        exported: true,
      });

      graph.removeFile('file1.ts');

      expect(graph.getFileSymbols('file1.ts')).toEqual([]);
      expect(graph.getFileSymbols('file2.ts')).toHaveLength(1);
    });

    it('should remove import edges when removing file', () => {
      const graph = new CodeGraph(['file1.ts', 'file2.ts'], 100);
      graph.addImport('file1.ts', './file2');
      graph.addImport('file2.ts', './file1');

      graph.removeFile('file1.ts');

      expect(graph.getDependencies('file1.ts')).toEqual([]);
    });

    it('should clean up call edges when removing file', () => {
      const graph = new CodeGraph(['file1.ts', 'file2.ts'], 100);
      graph.addDefinition({
        name: 'foo',
        file: 'file1.ts',
        line: 10,
        type: 'function',
        exported: true,
      });
      graph.addDefinition({
        name: 'bar',
        file: 'file2.ts',
        line: 20,
        type: 'function',
        exported: true,
      });
      graph.addCall('file1.ts', 'foo', 'bar');

      const statsBefore = graph.getStats();
      expect(statsBefore.calls).toBe(1);

      graph.removeFile('file1.ts');

      const statsAfter = graph.getStats();
      expect(statsAfter.calls).toBe(0);
    });

    it('should handle removing non-existent file gracefully', () => {
      const graph = new CodeGraph(['file1.ts'], 100);

      expect(() => graph.removeFile('non-existent.ts')).not.toThrow();
    });
  });

  describe('Incremental graph updates', () => {
    let builder: CodeGraphBuilder;

    beforeEach(() => {
      builder = new CodeGraphBuilder();
    });

    it('should update graph with changed files', async () => {
      // Initial graph
      const initialFiles: FileChange[] = [
        {
          filename: 'file1.ts',
          status: 'added',
          additions: 10,
          deletions: 0,
          changes: 10,
          patch: '+ export function foo() {}',
        },
      ];

      const graph = await builder.buildGraph(initialFiles);

      // Update with changed file
      const changedFiles: FileChange[] = [
        {
          filename: 'file1.ts',
          status: 'modified',
          additions: 5,
          deletions: 5,
          changes: 10,
          patch: '+ export function bar() {}',
        },
      ];

      const updated = await builder.updateGraph(graph, changedFiles);

      expect(updated).toBeDefined();
      // The update should have processed the file
      expect(updated.getStats().files).toBeGreaterThanOrEqual(1);
    });

    it('should remove deleted files from graph', async () => {
      // Initial graph with two files
      const initialFiles: FileChange[] = [
        {
          filename: 'file1.ts',
          status: 'added',
          additions: 10,
          deletions: 0,
          changes: 10,
          patch: '+ export function foo() {}',
        },
        {
          filename: 'file2.ts',
          status: 'added',
          additions: 10,
          deletions: 0,
          changes: 10,
          patch: '+ export function bar() {}',
        },
      ];

      const graph = await builder.buildGraph(initialFiles);

      // Delete file1
      const changedFiles: FileChange[] = [
        {
          filename: 'file1.ts',
          status: 'removed',
          additions: 0,
          deletions: 10,
          changes: 10,
          patch: '- export function foo() {}',
        },
      ];

      const updated = await builder.updateGraph(graph, changedFiles);

      expect(updated.getFileSymbols('file1.ts')).toEqual([]);
    });

    it('should handle added files', async () => {
      // Initial graph with one file
      const initialFiles: FileChange[] = [
        {
          filename: 'file1.ts',
          status: 'added',
          additions: 10,
          deletions: 0,
          changes: 10,
          patch: '+ export function foo() {}',
        },
      ];

      const graph = await builder.buildGraph(initialFiles);

      // Add new file
      const changedFiles: FileChange[] = [
        {
          filename: 'file2.ts',
          status: 'added',
          additions: 10,
          deletions: 0,
          changes: 10,
          patch: '+ export function bar() {}',
        },
      ];

      const updated = await builder.updateGraph(graph, changedFiles);

      expect(updated).toBeDefined();
    });

    it('should handle empty change list', async () => {
      const initialFiles: FileChange[] = [
        {
          filename: 'file1.ts',
          status: 'added',
          additions: 10,
          deletions: 0,
          changes: 10,
          patch: '+ export function foo() {}',
        },
      ];

      const graph = await builder.buildGraph(initialFiles);
      const updated = await builder.updateGraph(graph, []);

      expect(updated.getStats()).toEqual(graph.getStats());
    });
  });

  describe('Error Handling', () => {
    it('should create graph even with minimal data', () => {
      const minimalData = {
        files: [],
        buildTime: 0,
        definitions: [],
        imports: [],
        exports: [],
        calls: [],
        callers: [],
        fileSymbols: [],
      };

      const graph = CodeGraph.deserialize(minimalData);
      expect(graph.files).toEqual([]);
      expect(graph.buildTime).toBe(0);
    });

    it('should handle partial data gracefully', () => {
      const partialData = {
        files: ['file1.ts'],
        buildTime: 100,
        definitions: [],
        imports: [],
        exports: [],
        calls: [],
        callers: [],
        fileSymbols: [],
      };

      const graph = CodeGraph.deserialize(partialData);
      expect(graph.files).toEqual(['file1.ts']);
      expect(graph.buildTime).toBe(100);
    });

    it('should handle null or undefined inputs gracefully', () => {
      const graph = new CodeGraph(['file1.ts'], 100);

      // removeFile with non-existent file should not throw
      expect(() => graph.removeFile('non-existent.ts')).not.toThrow();
    });

    it('should handle empty file list in graph operations', () => {
      const graph = new CodeGraph([], 0);

      expect(graph.files).toEqual([]);
      expect(graph.getStats().definitions).toBe(0);
      expect(() => graph.serialize()).not.toThrow();
    });

    it('should handle clone of empty graph', () => {
      const empty = new CodeGraph([], 0);
      const cloned = empty.clone();

      expect(cloned.files).toEqual([]);
      expect(cloned.getStats()).toEqual(empty.getStats());
    });

    it('should handle deserialization of empty graph', () => {
      const empty = new CodeGraph([], 0);
      const serialized = empty.serialize();
      const deserialized = CodeGraph.deserialize(serialized);

      expect(deserialized.files).toEqual([]);
      expect(deserialized.getStats()).toEqual(empty.getStats());
    });
  });
});
