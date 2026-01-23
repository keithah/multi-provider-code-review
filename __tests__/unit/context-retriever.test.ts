import { ContextRetriever } from '../../src/analysis/context';
import { FileChange } from '../../src/types';

describe('ContextRetriever', () => {
  it('extracts dependency relationships from imports', () => {
    const retriever = new ContextRetriever();
    const files: FileChange[] = [
      {
        filename: 'src/auth.ts',
        status: 'modified',
        additions: 2,
        deletions: 0,
        changes: 2,
        patch: '@@ -1,1 +1,3 @@\n+import api from "./api"\n+export const x = 1;\n',
      },
    ];

    const context = retriever.findRelatedContext(files);

    expect(context).toHaveLength(1);
    expect(context[0].relationship).toBe('dependency');
    expect(context[0].downstreamConsumers).toContain('./api');
    expect(context[0].affectedCode.length).toBeGreaterThan(0);
  });
});
