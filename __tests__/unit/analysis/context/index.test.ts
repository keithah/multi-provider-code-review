import { CodeGraph, CodeGraphBuilder } from '../../../../src/analysis/context/index';

describe('Context Module', () => {
  it('should export required components', () => {
    expect(CodeGraph).toBeDefined();
    expect(CodeGraphBuilder).toBeDefined();
  });
});
