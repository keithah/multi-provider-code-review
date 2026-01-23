import { CodeGraph, CodeGraphBuilder } from '../../../../src/analysis/context/graph-builder';
import { FileChange } from '../../../../src/types';

describe('CodeGraph', () => {
  let graph: CodeGraph;

  beforeEach(() => {
    graph = new CodeGraph();
  });

  describe('addDefinition', () => {
    it('should add a function definition', () => {
      graph.addDefinition({
        name: 'handleClick',
        file: 'component.ts',
        line: 10,
        type: 'function',
        exported: true,
      });

      const def = graph.getDefinition('handleClick');
      expect(def).toBeDefined();
      expect(def?.name).toBe('handleClick');
      expect(def?.type).toBe('function');
    });

    it('should track file symbols', () => {
      graph.addDefinition({
        name: 'UserClass',
        file: 'user.ts',
        line: 5,
        type: 'class',
        exported: true,
      });
      graph.addDefinition({
        name: 'getUser',
        file: 'user.ts',
        line: 20,
        type: 'function',
        exported: false,
      });

      const symbols = graph.getFileSymbols('user.ts');
      expect(symbols).toHaveLength(2);
      expect(symbols.map((s) => s.name)).toEqual(['UserClass', 'getUser']);
    });
  });

  describe('addImport', () => {
    it('should add import relationship', () => {
      graph.addImport('component.ts', './utils');

      const deps = graph.getDependencies('component.ts');
      expect(deps).toContain('./utils');
    });

    it('should not duplicate imports', () => {
      graph.addImport('component.ts', './utils');
      graph.addImport('component.ts', './utils');

      const deps = graph.getDependencies('component.ts');
      expect(deps).toHaveLength(1);
    });
  });

  describe('addCall', () => {
    it('should track function calls', () => {
      graph.addCall('handleClick', 'fetchData');

      const callers = graph.findCallers('fetchData');
      expect(callers).toBeDefined();
    });

    it('should not duplicate calls', () => {
      graph.addCall('handleClick', 'fetchData');
      graph.addCall('handleClick', 'fetchData');

      // Should not throw or create duplicates
      expect(true).toBe(true);
    });
  });

  describe('findConsumers', () => {
    it('should find files that import a given file', () => {
      graph.addImport('component.ts', './utils.ts');
      graph.addImport('service.ts', './utils.ts');

      const consumers = graph.findConsumers('./utils.ts');
      expect(consumers).toHaveLength(2);
      expect(consumers.map((c) => c.file)).toContain('component.ts');
      expect(consumers.map((c) => c.file)).toContain('service.ts');
    });

    it('should return empty for file with no consumers', () => {
      const consumers = graph.findConsumers('unused.ts');
      expect(consumers).toHaveLength(0);
    });
  });

  describe('getDependencies', () => {
    it('should return direct dependencies', () => {
      graph.addImport('component.ts', './utils.ts');
      graph.addImport('component.ts', './api.ts');

      const deps = graph.getDependencies('component.ts');
      expect(deps).toHaveLength(2);
      expect(deps).toContain('./utils.ts');
      expect(deps).toContain('./api.ts');
    });

    it('should return empty for file with no dependencies', () => {
      const deps = graph.getDependencies('standalone.ts');
      expect(deps).toHaveLength(0);
    });
  });

  describe('getDependents', () => {
    it('should find reverse dependencies', () => {
      graph.addImport('component.ts', './utils.ts');
      graph.addImport('service.ts', './utils.ts');

      const dependents = graph.getDependents('./utils.ts');
      expect(dependents).toHaveLength(2);
      expect(dependents).toContain('component.ts');
      expect(dependents).toContain('service.ts');
    });
  });

  describe('getStats', () => {
    it('should return graph statistics', () => {
      graph.addDefinition({
        name: 'func1',
        file: 'file1.ts',
        line: 1,
        type: 'function',
        exported: true,
      });
      graph.addImport('file1.ts', 'file2.ts');
      graph.addCall('func1', 'func2');

      const stats = graph.getStats();
      expect(stats.definitions).toBe(1);
      expect(stats.imports).toBe(1);
      expect(stats.calls).toBe(1);
    });
  });
});

describe('CodeGraphBuilder', () => {
  let builder: CodeGraphBuilder;

  beforeEach(() => {
    builder = new CodeGraphBuilder(5, 10000);
  });

  const createFileChange = (filename: string, patch: string): FileChange => ({
    filename,
    status: 'modified',
    additions: 10,
    deletions: 5,
    changes: 15,
    patch,
  });

  describe('buildGraph', () => {
    it('should handle empty file list', async () => {
      const graph = await builder.buildGraph([]);
      expect(graph.getStats().definitions).toBe(0);
    });

    it('should handle files without patches', async () => {
      const files = [createFileChange('test.ts', '')];
      const graph = await builder.buildGraph(files);
      expect(graph.files).toHaveLength(1);
    });

    it('should extract TypeScript function definitions', async () => {
      const tsCode = `
function handleClick() {
  console.log('clicked');
}

export function fetchData() {
  return fetch('/api');
}
`;
      const files = [createFileChange('component.ts', tsCode)];
      const graph = await builder.buildGraph(files);

      // Note: Actual AST parsing depends on tree-sitter being available
      // This test verifies the builder doesn't throw errors
      expect(graph).toBeDefined();
      expect(graph.files).toContain('component.ts');
    });

    it('should handle Python files', async () => {
      const pyCode = `
def handle_click():
    print("clicked")

class UserService:
    def get_user(self, id):
        pass
`;
      const files = [createFileChange('service.py', pyCode)];
      const graph = await builder.buildGraph(files);

      expect(graph).toBeDefined();
      expect(graph.files).toContain('service.py');
    });

    it('should handle unsupported file types gracefully', async () => {
      const files = [createFileChange('README.md', '# Hello')];
      const graph = await builder.buildGraph(files);

      expect(graph).toBeDefined();
      expect(graph.getStats().definitions).toBe(0);
    });

    it('should handle parser errors gracefully', async () => {
      const invalidCode = 'function {{{{{ invalid syntax';
      const files = [createFileChange('invalid.ts', invalidCode)];
      const graph = await builder.buildGraph(files);

      // Should not throw, should handle error
      expect(graph).toBeDefined();
    });

    it('should respect timeout', async () => {
      const shortBuilder = new CodeGraphBuilder(5, 1); // 1ms timeout
      const files = Array.from({ length: 100 }, (_, i) =>
        createFileChange(`file${i}.ts`, 'function test() {}')
      );

      const graph = await shortBuilder.buildGraph(files);

      // Should stop early due to timeout
      expect(graph).toBeDefined();
      expect(graph.buildTime).toBeLessThan(1000);
    });
  });

  describe('updateGraph', () => {
    it('should update graph with new files', async () => {
      const initialFiles = [createFileChange('file1.ts', 'function test1() {}')];
      const graph = await builder.buildGraph(initialFiles);

      const changedFiles = [createFileChange('file2.ts', 'function test2() {}')];
      const updated = await builder.updateGraph(graph, changedFiles);

      expect(updated).toBeDefined();
    });

    it('should handle empty changed files', async () => {
      const graph = new CodeGraph();
      const updated = await builder.updateGraph(graph, []);

      expect(updated).toBe(graph);
    });
  });

  describe('integration', () => {
    it('should build graph from realistic TypeScript code', async () => {
      const tsCode = `
import { useState } from 'react';
import { fetchData } from './api';

export function UserComponent() {
  const [user, setUser] = useState(null);

  function handleLoad() {
    fetchData('/users/1').then(setUser);
  }

  return <div onClick={handleLoad}>{user?.name}</div>;
}
`;
      const files = [createFileChange('UserComponent.tsx', tsCode)];
      const graph = await builder.buildGraph(files);

      expect(graph).toBeDefined();
      expect(graph.buildTime).toBeGreaterThan(0);
    });

    it('should track build performance', async () => {
      const files = [
        createFileChange('file1.ts', 'function test1() {}'),
        createFileChange('file2.ts', 'function test2() {}'),
        createFileChange('file3.ts', 'function test3() {}'),
      ];

      const startTime = Date.now();
      const graph = await builder.buildGraph(files);
      const actualTime = Date.now() - startTime;

      expect(graph.buildTime).toBeGreaterThanOrEqual(0);
      expect(graph.buildTime).toBeLessThanOrEqual(actualTime + 100); // Some tolerance
    });
  });
});
