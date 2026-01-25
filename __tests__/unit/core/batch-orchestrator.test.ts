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

  it('returns empty batches for empty file list', () => {
    const orchestrator = new BatchOrchestrator({ defaultBatchSize: 3 });
    const batches = orchestrator.createBatches([], 3);
    expect(batches).toEqual([]);
  });

  it('throws on invalid batch sizes to avoid infinite loops', () => {
    const orchestrator = new BatchOrchestrator({ defaultBatchSize: 3 });
    expect(() => orchestrator.createBatches(makeFiles(2), 0)).toThrow(/invalid batch size/i);
    expect(() => orchestrator.createBatches(makeFiles(2), Number.NaN)).toThrow(/invalid batch size/i);
  });

  it('caps batch size using maxBatchSize even when overrides are larger', () => {
    const orchestrator = new BatchOrchestrator({
      defaultBatchSize: 25,
      maxBatchSize: 10,
      providerOverrides: { 'openrouter': 15 },
    });

    const batchSize = orchestrator.getBatchSize(['openrouter/model-x']);
    expect(batchSize).toBe(10); // capped by maxBatchSize
  });

  it('chooses the smallest override across mixed provider names', () => {
    const orchestrator = new BatchOrchestrator({
      defaultBatchSize: 8,
      providerOverrides: { openrouter: 5, opencode: 3 },
    });

    const batchSize = orchestrator.getBatchSize(['unknown', 'opencode/fast', 'openrouter/model']);
    expect(batchSize).toBe(3);
    const batches = orchestrator.createBatches(makeFiles(7), batchSize);
    expect(batches).toHaveLength(3);
  });
});
