import { BatchOrchestrator } from '../../../src/core/batch-orchestrator';
import { FileChange } from '../../../src/types';

const makeFiles = (count: number): FileChange[] =>
  Array.from({ length: count }).map((_, idx) => ({
    filename: `file-${idx}.ts`,
    status: 'modified',
    additions: 1,
    deletions: 0,
    changes: 1,
  }));

describe('BatchOrchestrator', () => {
  it('splits files into batches using default size', () => {
    const files = makeFiles(7);
    const orchestrator = new BatchOrchestrator({ defaultBatchSize: 3 });

    const batches = orchestrator.createBatches(files, orchestrator.getBatchSize(['provider/a']));

    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(3);
    expect(batches[2]).toHaveLength(1);
  });

  it('honors provider-specific override by picking the smallest', () => {
    const files = makeFiles(5);
    const orchestrator = new BatchOrchestrator({
      defaultBatchSize: 10,
      providerOverrides: { 'openrouter': 2 },
    });

    const batchSize = orchestrator.getBatchSize(['openrouter/model', 'opencode/model']);
    expect(batchSize).toBe(2);

    const batches = orchestrator.createBatches(files, batchSize);
    expect(batches).toHaveLength(3);
  });

  it('uses prefix overrides when exact match not provided', () => {
    const files = makeFiles(4);
    const orchestrator = new BatchOrchestrator({
      defaultBatchSize: 5,
      providerOverrides: { opencode: 1 },
    });

    const batchSize = orchestrator.getBatchSize(['opencode/gemini:free']);
    expect(batchSize).toBe(1);
    const batches = orchestrator.createBatches(files, batchSize);
    expect(batches.every(batch => batch.length === 1)).toBe(true);
  });
});
