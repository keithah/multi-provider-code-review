import { ContextRetriever } from '../../../src/analysis/context';
import { FileChange } from '../../../src/types';

describe('ContextRetriever', () => {
  let retriever: ContextRetriever;

  beforeEach(() => {
    retriever = new ContextRetriever();
  });

  it('should retrieve context for file changes', async () => {
    const files: FileChange[] = [
      {
        filename: 'test.ts',
        status: 'modified',
        additions: 5,
        deletions: 2,
        changes: 7,
        patch: '+const x = 1;',
      },
    ];

    const context = await retriever.getContext(files);
    expect(context).toBeDefined();
  });

  it('should handle empty file list', async () => {
    const context = await retriever.getContext([]);
    expect(context).toBeDefined();
  });
});
